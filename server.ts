import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import multer from "multer";
import * as XLSX from "xlsx";
import { format, addDays, isBefore, isAfter, startOfDay, endOfDay, parseISO, differenceInDays } from "date-fns";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

const db = new Database("subscriptions.db");

// Initialize Database
console.log("Initializing database...");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientName TEXT NOT NULL,
    phone TEXT,
    expirationDate TEXT,
    notes TEXT,
    referenceDate TEXT,
    reminderSentTwoDays INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add reminderSentTwoDays if it doesn't exist
const tableInfo = db.prepare("PRAGMA table_info(clients)").all();
const hasReminderColumn = tableInfo.some((col: any) => col.name === 'reminderSentTwoDays');
if (!hasReminderColumn) {
  console.log("Migrating database: Adding reminderSentTwoDays column...");
  db.exec("ALTER TABLE clients ADD COLUMN reminderSentTwoDays INTEGER DEFAULT 0");
}

console.log("Database initialized.");

// Seed admin user if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get("admin");
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run("admin", hashedPassword);
}

const app = express();
const PORT = 3000;
const upload = multer({ dest: "uploads/" });
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

app.use(express.json());

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({ error: "No token provided" });
  }
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2) {
    return res.status(401).json({ error: "Invalid authorization format" });
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// --- API ROUTES ---

// Auth
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  
  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: { username: user.username } });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Dashboard Stats
app.get("/api/stats", authenticate, (req, res) => {
  const clients: any[] = db.prepare("SELECT * FROM clients").all();
  const now = startOfDay(new Date());
  const in7Days = endOfDay(addDays(now, 7));
  const in30Days = endOfDay(addDays(now, 30));

  const stats = {
    total: clients.length,
    active: 0,
    expiringSoon: 0,
    expiringIn2Days: 0,
    expired: 0,
    renewalsToday: 0,
    renewals7Days: 0,
    renewals30Days: 0,
    byStatus: { active: 0, expiringSoon: 0, expired: 0 },
    byMonth: {} as Record<string, number>
  };

  clients.forEach(c => {
    const expirationDate = parseISO(c.expirationDate);
    const daysRemaining = differenceInDays(expirationDate, now);
    
    // Status Logic
    if (isBefore(expirationDate, now)) {
      stats.expired++;
      stats.byStatus.expired++;
    } else if (daysRemaining <= 7) {
      stats.expiringSoon++;
      stats.active++;
      stats.byStatus.expiringSoon++;
      if (daysRemaining === 2) {
        stats.expiringIn2Days++;
      }
    } else {
      stats.active++;
      stats.byStatus.active++;
    }

    // Renewals
    if (format(expirationDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) {
      stats.renewalsToday++;
    }
    if (isAfter(expirationDate, now) && isBefore(expirationDate, in7Days)) {
      stats.renewals7Days++;
    }
    if (isAfter(expirationDate, now) && isBefore(expirationDate, in30Days)) {
      stats.renewals30Days++;
    }

    // Month grouping
    const month = format(expirationDate, "MMM yyyy");
    stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
  });

  res.json(stats);
});

// Clients CRUD
app.get("/api/clients", authenticate, (req, res) => {
  const clients: any[] = db.prepare("SELECT * FROM clients ORDER BY expirationDate ASC").all();
  const now = startOfDay(new Date());
  
  const enrichedClients = clients.map(c => {
    const expirationDate = parseISO(c.expirationDate);
    const daysRemaining = differenceInDays(expirationDate, now);
    let status = 'Actif';
    
    if (isBefore(expirationDate, now)) {
      status = 'Expiré';
    } else if (daysRemaining <= 7) {
      status = 'Expire bientôt';
    }
    
    return { ...c, daysRemaining, status };
  });
  
  res.json(enrichedClients);
});

app.post("/api/clients", authenticate, (req, res) => {
  const { clientName, phone, expirationDate, notes, referenceDate } = req.body;
  const result = db.prepare(`
    INSERT INTO clients (clientName, phone, expirationDate, notes, referenceDate)
    VALUES (?, ?, ?, ?, ?)
  `).run(clientName, phone, expirationDate, notes, referenceDate);
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/clients/:id", authenticate, (req, res) => {
  const { clientName, phone, expirationDate, notes, referenceDate } = req.body;
  
  // Get current client to check if expiration date changed
  const currentClient: any = db.prepare("SELECT expirationDate FROM clients WHERE id = ?").get(req.params.id);
  const shouldResetReminder = currentClient && currentClient.expirationDate !== expirationDate;

  db.prepare(`
    UPDATE clients SET clientName = ?, phone = ?, expirationDate = ?, notes = ?, referenceDate = ?,
    reminderSentTwoDays = CASE WHEN ? THEN 0 ELSE reminderSentTwoDays END
    WHERE id = ?
  `).run(clientName, phone, expirationDate, notes, referenceDate, shouldResetReminder ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete("/api/clients/:id", authenticate, (req, res) => {
  db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/clients/:id/renew", authenticate, (req, res) => {
  const { id } = req.params;
  const client: any = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const currentExp = parseISO(client.expirationDate);
  const now = startOfDay(new Date());
  
  // If already expired, start from today. Otherwise, add to current expiration.
  const baseDate = isBefore(currentExp, now) ? now : currentExp;
  const newExpiration = format(addDays(baseDate, 30), 'yyyy-MM-dd');

  db.prepare(`
    UPDATE clients SET expirationDate = ?, reminderSentTwoDays = 0
    WHERE id = ?
  `).run(newExpiration, id);

  res.json({ success: true, newExpiration });
});

// --- NOTIFICATION SERVICE ---

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function checkExpiringSubscriptions() {
  console.log("Checking for expiring subscriptions...");
  const now = startOfDay(new Date());
  const clients: any[] = db.prepare("SELECT * FROM clients WHERE reminderSentTwoDays = 0").all();

  for (const client of clients) {
    const expirationDate = parseISO(client.expirationDate);
    const daysRemaining = differenceInDays(expirationDate, now);

    // Send reminder if expiring in 2 days or less (but still in future)
    if (daysRemaining <= 2 && daysRemaining >= 0) {
      try {
        console.log(`Sending notification for ${client.clientName}...`);
        await transporter.sendMail({
          from: `"Subscription Manager" <${process.env.EMAIL_USER}>`,
          to: "ahmedmasmoudi803@gmail.com",
          subject: `Subscription expiring in ${daysRemaining} days - ${client.clientName}`,
          text: `
Client: ${client.clientName}
Phone: ${client.phone || 'N/A'}
Expiration date: ${client.expirationDate}
Days remaining: ${daysRemaining}
Notes: ${client.notes || 'None'}
          `,
          html: `
            <h3>Subscription Expiration Reminder</h3>
            <p><strong>Client:</strong> ${client.clientName}</p>
            <p><strong>Phone:</strong> ${client.phone || 'N/A'}</p>
            <p><strong>Expiration date:</strong> ${client.expirationDate}</p>
            <p><strong>Days remaining:</strong> ${daysRemaining}</p>
            <p><strong>Notes:</strong> ${client.notes || 'None'}</p>
          `,
        });

        db.prepare("UPDATE clients SET reminderSentTwoDays = 1 WHERE id = ?").run(client.id);
        console.log(`Notification sent for ${client.clientName}`);
      } catch (err) {
        console.error(`Failed to send email for ${client.clientName}:`, err);
      }
    }
  }
}

// Run check every 24 hours
setInterval(checkExpiringSubscriptions, 24 * 60 * 60 * 1000);
// Also run once on startup
setTimeout(checkExpiringSubscriptions, 5000);

// JSON Import (Pre-processed by frontend)
app.post("/api/import-json", authenticate, (req, res) => {
  const { clients } = req.body;
  if (!Array.isArray(clients)) {
    return res.status(400).json({ error: "Invalid data format" });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO clients (clientName, phone, expirationDate, notes, referenceDate)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(
          String(row.clientName || ""),
          String(row.phone || ""),
          String(row.expirationDate || ""),
          String(row.notes || ""),
          String(row.referenceDate || "")
        );
      }
    });

    transaction(clients);
    res.json({ success: true, count: clients.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save imported clients" });
  }
});

// Excel Import (Legacy/Direct)
app.post("/api/import", authenticate, upload.single("file"), (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = "Clients";
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      return res.status(400).json({ error: "Sheet 'Clients' not found in workbook" });
    }

    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    const insert = db.prepare(`
      INSERT INTO clients (clientName, phone, expirationDate, notes, referenceDate)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        // Mapping from French Excel columns exactly as requested
        const name = row["Nom du client"] || row.clientName;
        const phone = row["Téléphone"] || row.phone;
        let expiration = row["Date d'expiration"] || row.expirationDate;
        const notes = row["Notes"] || row.notes || "";
        let reference = row["Date de référence"] || row.referenceDate;

        // Handle Excel date serial numbers
        if (typeof expiration === 'number') expiration = format(XLSX.SSF.parse_date_code(expiration), 'yyyy-MM-dd');
        if (typeof reference === 'number') reference = format(XLSX.SSF.parse_date_code(reference), 'yyyy-MM-dd');

        if (name && expiration) {
          insert.run(String(name), String(phone || ""), String(expiration), String(notes), String(reference || ""));
        }
      }
    });

    transaction(data);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, count: data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process Excel file" });
  }
});

// Excel Export
app.get("/api/export", authenticate, (req, res) => {
  const clients = db.prepare(`
    SELECT 
      clientName as 'Nom du client', 
      phone as 'Téléphone', 
      expirationDate as 'Date d''expiration', 
      notes as 'Notes', 
      referenceDate as 'Date de référence' 
    FROM clients
  `).all();
  const worksheet = XLSX.utils.json_to_sheet(clients);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
  
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=chatgpt_pro_clients.xlsx");
  res.send(buffer);
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
