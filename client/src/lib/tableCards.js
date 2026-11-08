import { useEffect } from 'react';

// Copies each column's header text onto the cells beneath it as `data-label`,
// which the `table-cards` CSS shows beside the value once a table is stacked
// into cards on a phone. Done in one place, driven by what's on screen, so a
// table opts in with a single class and tables loaded later are picked up too.

const SELECTOR = 'table.table-cards';

export function labelTable(table) {
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
  if (!headers.length) return;

  table.querySelectorAll('tbody tr').forEach((row) => {
    let column = 0;
    Array.from(row.children).forEach((cell) => {
      const span = cell.colSpan || 1;
      const label = span === 1 ? headers[column] : '';
      if (label) {
        if (cell.dataset.label !== label) cell.dataset.label = label;
      } else if ('label' in cell.dataset) {
        delete cell.dataset.label;
      }
      column += span;
    });
  });
}

export function labelAllTables(root = document) {
  root.querySelectorAll(SELECTOR).forEach(labelTable);
}

export function useTableCardLabels() {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        labelAllTables();
      });
    };

    labelAllTables();
    // childList only: setting data-label is an attribute change, so this can't loop.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
