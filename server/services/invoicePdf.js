const PDFDocument = require('pdfkit');

const KIND_LABELS = { item: '', discount: 'Discount', fee: 'Fee', tax: 'Tax' };

function money(amount) {
  return `GHS ${Number(amount).toFixed(2)}`;
}

// Renders a simple one-page invoice document and returns the PDFDocument
// stream (caller pipes it straight to the HTTP response or a file).
function renderInvoicePdf(invoice, items) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.fontSize(20).text("Mum's Love Laundry", { continued: false });
  doc.fontSize(10).fillColor('#555').text('Invoice');
  doc.moveDown(1.5);

  doc.fillColor('#000').fontSize(14).text(invoice.invoice_number);
  doc.fontSize(10).fillColor('#555');
  doc.text(`Due date: ${new Date(invoice.due_date).toISOString().slice(0, 10)}`);
  doc.text(`Created: ${new Date(invoice.created_at).toISOString().slice(0, 10)}`);
  doc.moveDown(1);

  doc.fillColor('#000').fontSize(11).text('Bill To');
  doc.fontSize(10).fillColor('#555');
  doc.text(invoice.customer_name);
  doc.text(invoice.customer_phone);
  if (invoice.customer_email) doc.text(invoice.customer_email);
  doc.moveDown(1.5);

  const tableTop = doc.y;
  doc.fillColor('#000').fontSize(10);
  doc.text('Description', 50, tableTop, { width: 250 });
  doc.text('Qty', 300, tableTop, { width: 50, align: 'right' });
  doc.text('Unit', 350, tableTop, { width: 90, align: 'right' });
  doc.text('Amount', 440, tableTop, { width: 100, align: 'right' });
  doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).strokeColor('#ccc').stroke();

  let y = tableTop + 22;
  items.forEach((item) => {
    const label = KIND_LABELS[item.kind] ? `${item.description} (${KIND_LABELS[item.kind]})` : item.description;
    doc.fillColor('#000').fontSize(10);
    doc.text(label, 50, y, { width: 250 });
    doc.text(String(item.quantity), 300, y, { width: 50, align: 'right' });
    doc.text(money(item.unit_amount), 350, y, { width: 90, align: 'right' });
    doc.text(money(item.line_total), 440, y, { width: 100, align: 'right' });
    y += 18;
  });

  doc.moveTo(50, y + 4).lineTo(540, y + 4).strokeColor('#ccc').stroke();
  y += 14;

  doc.fontSize(10).text('Subtotal', 350, y, { width: 90, align: 'right' });
  doc.text(money(invoice.subtotal), 440, y, { width: 100, align: 'right' });
  y += 18;

  doc.fontSize(12).text('Total', 350, y, { width: 90, align: 'right' });
  doc.text(money(invoice.total_amount), 440, y, { width: 100, align: 'right' });
  y += 24;

  if (invoice.notes) {
    doc.fontSize(10).fillColor('#555').text('Notes', 50, y);
    doc.text(invoice.notes, 50, y + 14, { width: 490 });
  }

  doc.end();
  return doc;
}

module.exports = { renderInvoicePdf };
