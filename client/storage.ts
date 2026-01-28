import Database from 'better-sqlite3';
import { CapturedRequest } from './tunnel.js';

export class RequestStorage {
    private db: Database.Database;

    constructor(dbPath: string = './requests.db') {
        this.db = new Database(dbPath);
        this.initDatabase();
    }

    private initDatabase() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        headers TEXT NOT NULL,
        body TEXT,
        query TEXT NOT NULL,
        response_status INTEGER,
        response_headers TEXT,
        response_body TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp);
      CREATE INDEX IF NOT EXISTS idx_method ON requests(method);
      CREATE INDEX IF NOT EXISTS idx_path ON requests(path);
    `);
    }

    saveRequest(request: CapturedRequest): void {
        const stmt = this.db.prepare(`
      INSERT INTO requests (
        id, timestamp, method, path, headers, body, query,
        response_status, response_headers, response_body
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            request.id,
            request.timestamp.getTime(),
            request.method,
            request.path,
            JSON.stringify(request.headers),
            request.body,
            JSON.stringify(request.query),
            request.response?.statusCode || null,
            request.response ? JSON.stringify(request.response.headers) : null,
            request.response?.body || null
        );
    }

    getRequest(id: string): CapturedRequest | null {
        const stmt = this.db.prepare('SELECT * FROM requests WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) return null;

        return this.rowToRequest(row);
    }

    getRequestByPrefix(prefix: string): CapturedRequest | null {
        const stmt = this.db.prepare(
            'SELECT * FROM requests WHERE id LIKE ?'
        );

        const rows = stmt.all(`${prefix}%`) as any[];

        if (rows.length === 0) return null;

        if (rows.length > 1) {
            throw new Error(`Ambiguous request id prefix (${rows.length} matches)`);
        }

        return this.rowToRequest(rows[0]);
    }

    getAllRequests(limit: number = 100): CapturedRequest[] {
        const stmt = this.db.prepare(`
      SELECT * FROM requests 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

        const rows = stmt.all(limit) as any[];
        return rows.map(row => this.rowToRequest(row));
    }

    searchRequests(filters: {
        method?: string;
        path?: string;
        limit?: number;
    }): CapturedRequest[] {
        let query = 'SELECT * FROM requests WHERE 1=1';
        const params: any[] = [];

        if (filters.method) {
            query += ' AND method = ?';
            params.push(filters.method);
        }

        if (filters.path) {
            query += ' AND path LIKE ?';
            params.push(`%${filters.path}%`);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(filters.limit || 100);

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as any[];

        return rows.map(row => this.rowToRequest(row));
    }

    deleteRequest(id: string): void {
        const stmt = this.db.prepare('DELETE FROM requests WHERE id = ?');
        stmt.run(id);
    }

    clearAll(): void {
        this.db.exec('DELETE FROM requests');
    }

    getStats(): {
        total: number;
        byMethod: Record<string, number>;
        byStatus: Record<number, number>;
    } {
        const total = (this.db.prepare('SELECT COUNT(*) as count FROM requests').get() as any).count;

        const byMethod = this.db.prepare(`
      SELECT method, COUNT(*) as count 
      FROM requests 
      GROUP BY method
    `).all() as any[];

        const byStatus = this.db.prepare(`
      SELECT response_status, COUNT(*) as count 
      FROM requests 
      WHERE response_status IS NOT NULL
      GROUP BY response_status
    `).all() as any[];

        return {
            total,
            byMethod: Object.fromEntries(byMethod.map(r => [r.method, r.count])),
            byStatus: Object.fromEntries(byStatus.map(r => [r.response_status, r.count]))
        };
    }

    private rowToRequest(row: any): CapturedRequest {
        return {
            id: row.id,
            timestamp: new Date(row.timestamp),
            method: row.method,
            path: row.path,
            headers: JSON.parse(row.headers),
            body: row.body,
            query: JSON.parse(row.query),
            response: row.response_status ? {
                statusCode: row.response_status,
                headers: JSON.parse(row.response_headers),
                body: row.response_body
            } : undefined
        };
    }

    close(): void {
        this.db.close();
    }
}
