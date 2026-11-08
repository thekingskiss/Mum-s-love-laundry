import { beforeEach, describe, expect, it } from 'vitest';
import { labelAllTables, labelTable } from './tableCards.js';

function build(html) {
  document.body.innerHTML = html;
  return document.querySelector('table');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('labelTable', () => {
  it('copies each column header onto the cells beneath it', () => {
    const table = build(`
      <table class="table-cards">
        <thead><tr><th>Date</th><th>Method</th><th>Amount</th></tr></thead>
        <tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody>
      </table>`);
    labelTable(table);
    expect([...table.querySelectorAll('td')].map((td) => td.dataset.label)).toEqual(['Date', 'Method', 'Amount']);
  });

  it('keeps labels lined up past a cell that spans several columns', () => {
    const table = build(`
      <table class="table-cards">
        <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
        <tbody><tr><td colspan="2">wide</td><td>c</td></tr></tbody>
      </table>`);
    labelTable(table);
    const [wide, last] = table.querySelectorAll('td');
    expect(wide.dataset.label).toBeUndefined();
    expect(last.dataset.label).toBe('C');
  });

  it('skips cells under an empty header, such as an actions column', () => {
    const table = build(`
      <table class="table-cards">
        <thead><tr><th>Name</th><th></th></tr></thead>
        <tbody><tr><td>x</td><td><button>Edit</button></td></tr></tbody>
      </table>`);
    labelTable(table);
    const [, actions] = table.querySelectorAll('td');
    expect(actions.dataset.label).toBeUndefined();
  });

  it('labels rows added later', () => {
    const table = build(`
      <table class="table-cards">
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>first</td></tr></tbody>
      </table>`);
    labelTable(table);
    table.querySelector('tbody').insertAdjacentHTML('beforeend', '<tr><td>second</td></tr>');
    labelTable(table);
    expect([...table.querySelectorAll('td')].map((td) => td.dataset.label)).toEqual(['Name', 'Name']);
  });

  it('ignores a table without a header row', () => {
    const table = build('<table class="table-cards"><tbody><tr><td>x</td></tr></tbody></table>');
    labelTable(table);
    expect(table.querySelector('td').dataset.label).toBeUndefined();
  });
});

describe('labelAllTables', () => {
  it('only touches tables that opted in', () => {
    document.body.innerHTML = `
      <table class="table-cards"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
      <table id="plain"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>`;
    labelAllTables();
    expect(document.querySelector('.table-cards td').dataset.label).toBe('A');
    expect(document.querySelector('#plain td').dataset.label).toBeUndefined();
  });
});
