interface DataTableProps {
  columns: string[];
  rows: Record<string, string>[];
  data?: Record<string, string>[];
}

export function DataTable({ columns, rows, data }: DataTableProps) {
  const displayRows = data ?? rows;

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
      </tbody>
    </table>
  );
}
