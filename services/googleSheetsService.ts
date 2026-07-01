
export async function fetchGoogleSheetData(sheetId: string, sheetName: string) {
    try {
        // Use headers=1 to encourage Google to treat the first row as headers
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&headers=1`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('Invalid JSON response from Google Sheets');
        }
        
        const jsonString = text.substring(jsonStart, jsonEnd + 1);
        const data = JSON.parse(jsonString);
        
        if (data.status === 'error') {
            throw new Error(data.errors?.[0]?.detailed_message || 'Google Sheets API error');
        }

        let rows = data.table.rows || [];
        let cols = data.table.cols || [];
        
        // If Google didn't provide good labels, try to use the first row of data
        // This happens if the sheet isn't explicitly configured with a header row
        const hasGenericLabels = cols.every((c: any) => !c.label || /^[A-Z]{1,2}$/.test(c.label));
        
        if (hasGenericLabels && rows.length > 0) {
            const firstRow = rows[0];
            // Check if the first row looks like headers (all strings)
            const looksLikeHeaders = firstRow && Array.isArray(firstRow.c) && firstRow.c.every((cell: any) => !cell || typeof cell.v === 'string');
            
            if (looksLikeHeaders) {
                cols = cols.map((c: any, i: number) => ({
                    ...c,
                    label: firstRow.c[i] ? String(firstRow.c[i].v) : c.label
                }));
                rows = rows.slice(1);
            }
        }

        return rows
            .filter((row: any) => row && Array.isArray(row.c))
            .map((row: any) => {
                const obj: any = {};
                row.c.forEach((cell: any, index: number) => {
                    if (cols[index]) {
                        const colName = cols[index].label || cols[index].id || `col_${index}`;
                        // Use formatted value (f) if available, otherwise raw value (v)
                        obj[colName] = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : cell.v) : null;
                    }
                });
                return obj;
            });
    } catch (error) {
        console.error(`Error fetching sheet "${sheetName}":`, error);
        throw error;
    }
}

/**
 * Deletes a single row from the Future_Blog_Ideas_Copied tab via the
 * Apps Script webhook. Used by the Content Audit "Remove duplicate"
 * action — never touches Blog Schedule, so already-scheduled or
 * already-published content is never at risk of being deleted.
 */
export async function deleteIdeaRow(title: string, rowNumber: number): Promise<boolean> {
    const { SUPABASE_CONFIG } = await import('./config');
    const webhookUrl = SUPABASE_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('Google Sheets webhook URL is not configured.');
    }

    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Apps Script doPost expects this
        body: JSON.stringify({
            appSource: 'BigInsured_Studio',
            type: 'delete_row',
            title,
            rowNumber,
        }),
    });

    const text = await res.text();
    if (!text.startsWith('Success')) {
        throw new Error(text || 'Failed to delete row from Ideas tab.');
    }
    return true;
}
