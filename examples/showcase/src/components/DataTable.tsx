interface DataTableProps {
  columns: string[];
  rows: Record<string, string>[];
  data?: unknown;
}

export function DataTable({ columns, rows, data }: DataTableProps) {
  let displayRows = rows;

  if (Array.isArray(data)) {
    displayRows = data;
  } else if (typeof data === 'string' && data.length > 0 && data !== 'all') {
    const term = data.toLowerCase();
    displayRows = rows.filter((row) =>
      columns.some((col) => (row[col] ?? '').toLowerCase().includes(term)),
    );
  }

  return (
    <table className="flui-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayRows.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col}>{row[col] ?? ''}</td>
            ))}
          </tr>
        ))}
        {displayRows.length === 0 && (
          <tr>
            <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No matching rows
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
