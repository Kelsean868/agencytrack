import React from 'react';

/**
 * DataTable — the plain table behind every FR chart's "Table" toggle.
 *
 * Spec: DESKTOP3.md "Glanceable rules" 3 — every chart can swap to a plain
 * table of the same values. Real <table>, caption for screen readers, column
 * headers scoped, numbers right-aligned with tabular figures.
 *
 * @param {object} props
 * @param {{ key: string, label: string, align?: 'left'|'right'|'center', format?: (v:any)=>string }[]} props.columns
 * @param {object[]} props.rows  plain objects keyed by column key (optional `key` / `id` for React keys)
 * @param {string} props.caption  what the table shows (screen-reader only)
 */
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

function cellAlign(col, rows) {
  if (col.align) return ALIGN[col.align] || ALIGN.left;
  const first = rows.find((r) => r[col.key] !== undefined && r[col.key] !== null);
  return first && typeof first[col.key] === 'number' ? ALIGN.right : ALIGN.left;
}

export default function DataTable({ columns = [], rows = [], caption = 'Chart data' }) {
  const aligns = columns.map((col) => cellAlign(col, rows));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                className={`border-b border-border px-2 py-2 font-semibold text-ink-muted ${aligns[i]}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className="px-2 py-3 text-ink-muted">
                No data yet
              </td>
            </tr>
          ) : (
            rows.map((row, r) => (
              <tr key={row.key ?? row.id ?? r} className="border-b border-border last:border-b-0">
                {columns.map((col, i) => {
                  const raw = row[col.key];
                  const text = col.format ? col.format(raw) : raw ?? '';
                  return (
                    <td key={col.key} className={`px-2 py-2 tabular-nums text-ink ${aligns[i]}`}>
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
