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

export const generatePDF = (title: string, data: any, items: any[], entity: any, companyInfo: any = {}) => {
  try {
    const doc = new jsPDF();
    const margin = 15;
    const isBL = title === "BON DE LIVRAISON";

    // Use dynamic company info or fallback to defaults
    const cName = companyInfo.companyName || "SA-COMPANY";
    const cICE = companyInfo.companyICE || "000000000000000";
    const cAddress = companyInfo.companyAddress || "Votre Adresse Ici, Casablanca";
    const cEmail = companyInfo.companyEmail || "contact@sacompany.ma";
    const cPhone = companyInfo.companyPhone || "+212 5XX XX XX XX";
    const cRIB = companyInfo.companyRIB || "000 000 0000000000000000 00";

    // Company Logo / Name
    doc.setFontSize(24);
    doc.setTextColor(30, 58, 138); // Dark Blue
    doc.setFont("helvetica", "bold");
    doc.text(cName, margin, 20);
    
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Votre partenaire B2B de confiance", margin, 25);

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
    doc.text(title === "BON DE COMMANDE" ? "FOURNISSEUR:" : "CLIENT:", margin, 50);
    
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
        fontSize: 10,
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
      styles: { fontSize: 9, cellPadding: 3 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    if (!isBL) {
      const totalExclTax = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.taxRate / 100)), 0);
      const totalInclTax = totalExclTax + totalTax;

      doc.setDrawColor(200);
      doc.setFillColor(250, 250, 250);
      doc.rect(130, finalY - 5, 65, 30, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.setFont("helvetica", "normal");
      doc.text(`Total HT:`, 135, finalY + 2);
      doc.text(`${totalExclTax.toFixed(2)} MAD`, 190, finalY + 2, { align: 'right' });

      doc.text(`TVA (20%):`, 135, finalY + 9);
      doc.text(`${totalTax.toFixed(2)} MAD`, 190, finalY + 9, { align: 'right' });

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text(`Total TTC:`, 135, finalY + 18);
      doc.text(`${totalInclTax.toFixed(2)} MAD`, 190, finalY + 18, { align: 'right' });

      const integerPart = Math.floor(totalInclTax);
      const decimalPart = Math.round((totalInclTax - integerPart) * 100);
      const amountInLetters = numberToFrenchWords(integerPart);
      const centsInLetters = decimalPart > 0 ? ` et ${numberToFrenchWords(decimalPart)} centimes` : "";
      
      let phrasePrefix = "";
      if (title === "FACTURE") phrasePrefix = "Arrêté la présente facture à la somme de :";
      else if (title === "BON DE COMMANDE") phrasePrefix = "Arrêté le présent bon de commande à la somme de :";
      else if (title === "DEVIS") phrasePrefix = "Arrêté le présent devis à la somme de :";

      const amountText = `${amountInLetters.toUpperCase()} DIRHAMS${centsInLetters.toUpperCase()}.`;
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text(phrasePrefix, margin, finalY + 35);
      doc.text(amountText, margin, finalY + 42); // Line break added here
    } else {
      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      const signatureY = finalY + 10;
      doc.text(`Fait à ......................., le ${data.date}`, 195, signatureY, { align: 'right' });
      doc.text("Cachet et Signature du Client:", 195, signatureY + 7, { align: 'right' });
      doc.rect(135, signatureY + 12, 60, 30);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.setFont("helvetica", "italic");
      doc.text("(Document de transport - Sans prix)", margin, signatureY + 45);
    }

    // Footer with Dynamic Company Details
    doc.setDrawColor(230);
    doc.line(margin, 275, 195, 275);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont("helvetica", "bold");
    doc.text(cName, 105, 280, { align: 'center' });
    doc.setFont("helvetica", "normal");
    const footerInfo = `ICE: ${cICE} | Adresse: ${cAddress} | Email: ${cEmail}\nTél: ${cPhone} | RIB: ${cRIB}`;
    doc.text(footerInfo, 105, 285, { align: 'center' });

    const docNumber = data.invoiceNumber || data.noteNumber || data.orderNumber || data.quoteNumber;
    const fileName = `${title}_${docNumber}_${entity.name.replace(/\s+/g, '_').toUpperCase()}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    alert("Erreur lors de la génération du PDF. Veuillez vérifier la console.");
  }
};
