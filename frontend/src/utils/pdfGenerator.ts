import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Simple French number to words converter
const numberToFrenchWords = (n: number): string => {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  if (n === 0) return 'zéro';

  const convert = (num: number): string => {
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      if (t === 7 || t === 9) {
        return tens[t - 1] + (u === 1 ? ' et ' : '-') + teens[u];
      }
      return tens[t] + (u === 1 ? ' et ' : u > 0 ? '-' : '') + units[u];
    }
    if (num < 1000) {
      const c = Math.floor(num / 100);
      const r = num % 100;
      const centStr = c === 1 ? 'cent' : units[c] + ' cents';
      return centStr + (r > 0 ? ' ' + convert(r) : '');
    }
    if (num < 1000000) {
      const m = Math.floor(num / 1000);
      const r = num % 1000;
      const milleStr = m === 1 ? 'mille' : convert(m) + ' mille';
      return milleStr + (r > 0 ? ' ' + convert(r) : '');
    }
    return num.toString();
  };

  return convert(n);
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Noms / marque par défaut (schéma) — ne pas imprimer sur les PDF. */
function isPlaceholderCompanyName(raw: string | undefined | null): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return true;
  return /^SA[\s_-]*COMPANY$/i.test(t);
}

function isPlaceholderIce(raw: string | undefined | null): boolean {
  const d = String(raw ?? '').replace(/\s/g, '');
  return !d || /^0+$/.test(d);
}

function isPlaceholderAddress(raw: string | undefined | null): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return true;
  return /votre adresse ici/i.test(t);
}

function isPlaceholderEmail(raw: string | undefined | null): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'contact@sacompany.ma';
}

function isPlaceholderPhone(raw: string | undefined | null): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return true;
  return t === '+212 5XX XX XX XX' || /^\+212\s*5XX(\s*XX){3}$/i.test(t);
}

function isPlaceholderRib(raw: string | undefined | null): boolean {
  const d = String(raw ?? '').replace(/\D/g, '');
  return !d || /^0+$/.test(d);
}

function inferPdfLogoMode(companyInfo: {
  logoMode?: string;
  logoDataUrl?: string;
}): 'image' | 'text' {
  const m = companyInfo.logoMode;
  if (m === 'text') return 'text';
  if (m === 'image') return 'image';
  const url = String(companyInfo.logoDataUrl ?? '');
  return url.startsWith('data:image') ? 'image' : 'text';
}

/** En-tête gauche : texte (plusieurs lignes possibles). */
function addLogoTextBlock(doc: jsPDF, text: string, margin: number): void {
  const t = text.trim();
  if (!t) return;
  doc.setFontSize(24);
  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(t, 110);
  doc.text(lines, margin, 20);
}

function addLogoImage(doc: jsPDF, logoDataUrl: string, margin: number): boolean {
  if (!logoDataUrl || !logoDataUrl.startsWith('data:image')) return false;
  const lower = logoDataUrl.toLowerCase();
  const formats: Array<'PNG' | 'JPEG' | 'WEBP'> = lower.includes('image/png')
    ? ['PNG', 'JPEG', 'WEBP']
    : lower.includes('image/jpeg') || lower.includes('image/jpg')
      ? ['JPEG', 'PNG', 'WEBP']
      : lower.includes('image/webp')
        ? ['WEBP', 'PNG', 'JPEG']
        : ['PNG', 'JPEG', 'WEBP'];
  for (const fmt of formats) {
    try {
      doc.addImage(logoDataUrl, fmt, margin, 5, 36, 36);
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

function buildFooterInfoLine(companyInfo: any): string {
  const parts: string[] = [];
  const ice = String(companyInfo?.companyICE ?? '').trim();
  if (!isPlaceholderIce(ice)) parts.push(`ICE: ${ice}`);
  const addr = String(companyInfo?.companyAddress ?? '').trim();
  if (!isPlaceholderAddress(addr)) parts.push(`Adresse: ${addr}`);
  const em = String(companyInfo?.companyEmail ?? '').trim();
  if (!isPlaceholderEmail(em)) parts.push(`Email: ${em}`);
  const ph = String(companyInfo?.companyPhone ?? '').trim();
  if (!isPlaceholderPhone(ph)) parts.push(`Tél: ${ph}`);
  const rib = String(companyInfo?.companyRIB ?? '').trim();
  if (!isPlaceholderRib(rib)) parts.push(`RIB: ${rib}`);
  return parts.join(' | ');
}

function buildPdfDocument(
  title: string,
  data: any,
  items: any[],
  entity: any,
  companyInfo: any = {},
  layoutMode: 'normal' | 'compact' = 'normal'
): { doc: jsPDF; filename: string } {
  const doc = new jsPDF();
    const margin = 15;
    const isBL = title === "BON DE LIVRAISON";
    const isCompact = layoutMode === 'compact';

    const footerLegalExtra = (companyInfo as { footerLegal?: string }).footerLegal || "";
    const logoDataUrl = (companyInfo as { logoDataUrl?: string }).logoDataUrl || "";
    const logoTextSetting = String((companyInfo as { logoText?: string }).logoText ?? '').trim();
    const cName = isPlaceholderCompanyName(companyInfo.companyName)
      ? ''
      : String(companyInfo.companyName ?? '').trim();

    const logoMode = inferPdfLogoMode(companyInfo as { logoMode?: string; logoDataUrl?: string });
    if (logoMode === 'text') {
      const headerText = logoTextSetting || cName;
      addLogoTextBlock(doc, headerText, margin);
    } else {
      const logoOk = addLogoImage(doc, logoDataUrl, margin);
      if (!logoOk && cName) {
        doc.setFontSize(24);
        doc.setTextColor(30, 58, 138);
        doc.setFont("helvetica", "bold");
        doc.text(cName, margin, 20);
      }
    }

    // Document Title
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129); // Emerald-500 (Green)
    doc.setFont("helvetica", "bold");
    doc.text(title, 195, 20, { align: 'right' });

    // Document Info (Right aligned)
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${data.date}`, 195, 30, { align: 'right' });
    doc.text(`Numéro: ${data.invoiceNumber || data.noteNumber || data.orderNumber || data.quoteNumber}`, 195, 35, { align: 'right' });

    // Entity Info (Client or Supplier)
    doc.setDrawColor(230);
    doc.line(margin, 40, 195, 40); // Divider line

    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.setFont("helvetica", "bold");
    doc.text(
      title === "BON DE COMMANDE" || title === "FACTURE ACHAT" ? "FOURNISSEUR:" : "CLIENT:",
      margin,
      50
    );
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${entity.name}`, margin, 57);
    if (entity.taxNumber) doc.text(`ICE: ${entity.taxNumber}`, margin, 63);
    if (entity.address) doc.text(`Adresse: ${entity.address}`, margin, 69);
    if (entity.phone) doc.text(`Tél: ${entity.phone}`, margin, 75);

    // Table
    let tableColumn, tableRows;
    const hasDates = items.some(item => item.date);
    
    if (isBL) {
      tableColumn = ["Désignation", "Quantité"];
      tableRows = items.map(item => [
        item.productName || item.name || "Produit",
        item.quantity
      ]);
    } else {
      tableColumn = hasDates 
        ? ["Date", "Désignation", "Qté", "Prix Unit. HT", "TVA", "Total HT"]
        : ["Désignation", "Qté", "Prix Unit. HT", "TVA", "Total HT"];
        
      tableRows = items.map(item => {
        const row = [
          item.productName || item.name || "Produit",
          item.quantity,
          `${parseFloat(item.unitPrice).toFixed(2)} MAD`,
          `${item.taxRate}%`,
          `${(item.quantity * item.unitPrice).toFixed(2)} MAD`
        ];
        if (hasDates) row.unshift(item.date || "-");
        return row;
      });
    }

    autoTable(doc, {
      startY: 85,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { 
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontSize: isCompact ? 9 : 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: isBL ? {
        0: { cellWidth: 140 },
        1: { halign: 'center' }
      } : {
        0: hasDates ? { cellWidth: 25, halign: 'center' } : { cellWidth: 80 },
        1: hasDates ? { cellWidth: 65 } : { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' },
        4: { halign: 'right' }
      },
      styles: { fontSize: isCompact ? 8 : 9, cellPadding: isCompact ? 2 : 3 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const footerTopY = 275;
    const contentBottomLimitY = footerTopY - 8;

    if (!isBL) {
      const totalExclTax = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.taxRate / 100)), 0);
      const totalInclTax = totalExclTax + totalTax;

      const integerPart = Math.floor(totalInclTax);
      const decimalPart = Math.round((totalInclTax - integerPart) * 100);
      const amountInLetters = numberToFrenchWords(integerPart);
      const centsInLetters = decimalPart > 0 ? ` et ${numberToFrenchWords(decimalPart)} centimes` : "";
      
      let phrasePrefix = "";
      if (title === "FACTURE") phrasePrefix = "Arrêté la présente facture à la somme de :";
      else if (title === "BON DE COMMANDE") phrasePrefix = "Arrêté le présent bon de commande à la somme de :";
      else if (title === "DEVIS") phrasePrefix = "Arrêté le présent devis à la somme de :";
      else if (title === "BON") phrasePrefix = "Arrêté le présent bon à la somme de :";
      else if (title === "FACTURE ACHAT") phrasePrefix = "Arrêté la présente facture d'achat à la somme de :";

      const amountText = `${amountInLetters.toUpperCase()} DIRHAMS${centsInLetters.toUpperCase()}.`;
      const amountLines = doc.splitTextToSize(amountText, isCompact ? 175 : 180) as string[];
      const amountLineHeight = isCompact ? 4.1 : 4.5;
      const phraseY = isCompact ? finalY + 30 : finalY + 35;
      const amountY = isCompact ? finalY + 36 : finalY + 42;
      const neededEndY = amountY + Math.max(0, amountLines.length - 1) * amountLineHeight;
      // Retry once in compact mode to keep totals + amount on same page as table.
      if (neededEndY > contentBottomLimitY && !isCompact) {
        return buildPdfDocument(title, data, items, entity, companyInfo, 'compact');
      }
      let sectionY = finalY;
      if (neededEndY > contentBottomLimitY) {
        doc.addPage();
        sectionY = 20;
      }

      doc.setDrawColor(200);
      doc.setFillColor(250, 250, 250);
      const boxHeight = isCompact ? 26 : 30;
      doc.rect(130, sectionY - 5, 65, boxHeight, 'FD');

      doc.setFontSize(isCompact ? 9 : 10);
      doc.setTextColor(40);
      doc.setFont("helvetica", "normal");
      doc.text(`Total HT:`, 135, sectionY + 2);
      doc.text(`${totalExclTax.toFixed(2)} MAD`, 190, sectionY + 2, { align: 'right' });

      doc.text(`TVA:`, 135, sectionY + (isCompact ? 8 : 9));
      doc.text(`${totalTax.toFixed(2)} MAD`, 190, sectionY + (isCompact ? 8 : 9), { align: 'right' });

      doc.setFontSize(isCompact ? 10 : 11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text(`Total TTC:`, 135, sectionY + (isCompact ? 15 : 18));
      doc.text(`${totalInclTax.toFixed(2)} MAD`, 190, sectionY + (isCompact ? 15 : 18), { align: 'right' });

      doc.setFontSize(isCompact ? 8 : 9);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text(phrasePrefix, margin, sectionY + (isCompact ? 30 : 35));
      doc.text(amountLines, margin, sectionY + (isCompact ? 36 : 42));
    } else {
      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      let signatureY = finalY + 10;
      if (signatureY + 42 > contentBottomLimitY) {
        doc.addPage();
        signatureY = 35;
      }
      doc.text(`Fait à Kenitra, le ${data.date}`, margin, signatureY);
      doc.text("Cachet et Signature du Client:", margin, signatureY + 7);
      doc.rect(margin, signatureY + 12, 70, 30);
      doc.text("Cachet et Signature:", 195, signatureY + 7, { align: 'right' });
      doc.rect(125, signatureY + 12, 70, 30);
    }

    // Footer with Dynamic Company Details (sans libellés par défaut type « SA COMPANY »)
    doc.setDrawColor(230);
    doc.line(margin, 275, 195, 275);
    doc.setFontSize(8);
    doc.setTextColor(100);
    let footerY = 280;
    if (cName) {
      doc.setFont("helvetica", "bold");
      doc.text(cName, 105, footerY, { align: 'center' });
      footerY += 5;
    }
    doc.setFont("helvetica", "normal");
    const footerInfo = buildFooterInfoLine(companyInfo);
    if (footerInfo) {
      doc.text(footerInfo, 105, footerY, { align: 'center', maxWidth: 180 });
      footerY += 5;
    }
    if (footerLegalExtra) {
      doc.setFontSize(7);
      doc.setTextColor(80);
      doc.text(footerLegalExtra, 105, footerY + 2, { align: 'center', maxWidth: 180 });
    }

    const docNum = data.invoiceNumber || data.noteNumber || data.orderNumber || data.quoteNumber;
    const fileName = `${title}_${docNum}_${entity.name.replace(/\s+/g, '_').toUpperCase()}.pdf`;
    return { doc, filename: fileName };
}

export const generatePDF = (title: string, data: any, items: any[], entity: any, companyInfo: any = {}) => {
  try {
    const { doc, filename } = buildPdfDocument(title, data, items, entity, companyInfo);
    doc.save(filename);
  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    alert("Erreur lors de la génération du PDF. Veuillez vérifier la console.");
  }
};

/** Télécharge le PDF et retourne une copie base64 (une seule construction du document). */
export function generatePDFSaveAndBase64(
  title: string,
  data: any,
  items: any[],
  entity: any,
  companyInfo: any = {}
): { filename: string; base64: string } {
  const { doc, filename } = buildPdfDocument(title, data, items, entity, companyInfo);
  doc.save(filename);
  const buf = doc.output('arraybuffer') as ArrayBuffer;
  return { filename, base64: arrayBufferToBase64(buf) };
}

function base64ToPdfBlob(base64: string): Blob {
  const binary = atob(base64);
  const n = binary.length;
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

/** Ouvre le PDF dans un nouvel onglet (à utiliser suite à un clic utilisateur). */
export function openPdfBase64InNewTab(base64: string): void {
  const blob = base64ToPdfBlob(base64);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    alert('Autorisez les pop-ups pour afficher le PDF.');
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function downloadPdfFromBase64(base64: string, filename: string): void {
  const blob = base64ToPdfBlob(base64);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Même rendu que le téléchargement, pour envoi e-mail / WhatsApp (pièce jointe). */
export function generatePDFAsBase64(
  title: string,
  data: any,
  items: any[],
  entity: any,
  companyInfo: any = {}
): { filename: string; base64: string } {
  const { doc, filename } = buildPdfDocument(title, data, items, entity, companyInfo);
  const buf = doc.output('arraybuffer') as ArrayBuffer;
  return { filename, base64: arrayBufferToBase64(buf) };
}
