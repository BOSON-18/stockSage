import * as fs from 'fs';
import * as path from 'path';


const AUDIT_FILE = path.join(process.cwd(), 'data', 'audit-log.json');

interface AuditEntry {
    timestamp: string;
    action: string;
    provider: string;
    detail: string;
    success: boolean;
}

function appendAudit(entry: AuditEntry): void {
    try {
        const dir = path.dirname(AUDIT_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let entries: AuditEntry[] = [];
        if (fs.existsSync(AUDIT_FILE)) {
            entries = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
        }

        entries.push(entry);

        if (entries.length > 500) entries = entries.slice(-500);
        fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2));

    } catch (error) {
        console.warn('Error in appendAudit')
    }
}

export function auditBrokerCall(action: string, success: boolean, detail: string = ''): void {
    appendAudit({
        timestamp: new Date().toISOString(),
        action: action,
        detail: detail,
        success: success,
        provider: 'groww'
    })
}

export function auditApiCall(provider: 'deepseek' | 'jev' | 'yahoo', action: string, success: boolean): void {
    appendAudit({
        timestamp: new Date().toISOString(),
        action,
        provider,
        detail: '',
        success
    })
}

export function getRecentAudits(count: number = 20): AuditEntry[] {
    try {
        if (fs.existsSync(AUDIT_FILE)) {
            const entries: AuditEntry[] = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
            return entries.slice(-count)
        }
    } catch (error) {
        console.warn('Error on getRecentAudits')
    }
    return []
}