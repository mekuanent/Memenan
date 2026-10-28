import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');
    const churchId = searchParams.get('churchId');
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    if (!memberId || !churchId) {
      return NextResponse.json({ error: 'Missing strict ID constraints.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    
    // Concurrently fetch the Church Details and Member Profile
    const [churchSnap, memberSnap] = await Promise.all([
      adminDb.collection('churches').doc(churchId).get(),
      adminDb.collection('users').doc(memberId).get()
    ]);

    if (!churchSnap.exists || !memberSnap.exists) {
      return NextResponse.json({ error: 'Core resolution nodes missing.' }, { status: 404 });
    }

    const churchData = churchSnap.data();
    const memberData = memberSnap.data();

    // Fetch matching secure records natively isolated to the member array bounds
    const txSnapshot = await adminDb.collection('transactions')
      .where('churchId', '==', churchId)
      .where('memberId', '==', memberId)
      .where('status', '==', 'completed')
      .get();

    // Filter implicitly server-side for accurate Year bounds mapping string isolations
    const activeTransactions = txSnapshot.docs
      .map(doc => doc.data())
      .filter(tx => tx.date && tx.date.startsWith(year));

    if (activeTransactions.length === 0) {
      return NextResponse.json({ error: `No active transaction blocks found for ${year}.` }, { status: 404 });
    }

    // ==========================================
    // PDF GENERATION PIPELINE (IRS Compliant Premium Design)
    // ==========================================
    const totalAmount = activeTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    
    // Core brand and neutral palettes mapped accurately
    const primaryColor = rgb(0.486, 0.227, 0.929); // #7c3aed Memenan Primary
    const darkColor = rgb(0.1, 0.1, 0.1);
    const grayColor = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.9, 0.9, 0.9);

    let page = pdfDoc.addPage([612, 792]); // Standard US Letter
    let { height, width } = page.getSize();
    let yPosition = height - 50;

    const addNewPage = () => {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    };

    // Header Background Block
    page.drawRectangle({ x: 0, y: height - 140, width: width, height: 140, color: rgb(0.98, 0.98, 0.99) });
    
    yPosition -= 20;
    page.drawText(churchData?.name || 'Authorized Network Church', { x: 50, y: yPosition, size: 26, font: helveticaBold, color: primaryColor });
    yPosition -= 20;
    page.drawText(`Tax ID (EIN): ${churchData?.taxId || 'PENDING'}`, { x: 50, y: yPosition, size: 10, font: helvetica, color: grayColor });
    yPosition -= 40;

    // Statement Title
    page.drawText(`${year} ANNUAL CONTRIBUTION STATEMENT`, { x: 50, y: yPosition, size: 16, font: helveticaBold, color: darkColor });
    yPosition -= 20;
    page.drawText(`Date Issued: ${new Date().toLocaleDateString()}`, { x: 50, y: yPosition, size: 10, font: helvetica, color: grayColor });
    
    yPosition -= 20;
    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: width - 50, y: yPosition }, thickness: 1, color: lightGray });
    yPosition -= 30;

    // Dual Content Info Box (Contributor & Summary)
    page.drawRectangle({ x: 50, y: yPosition - 55, width: width - 100, height: 75, color: rgb(1, 1, 1), borderColor: lightGray, borderWidth: 1 });
    
    page.drawText('PREPARED FOR:', { x: 70, y: yPosition, size: 9, font: helveticaBold, color: grayColor });
    page.drawText('TOTAL TAX-DEDUCTIBLE CONTRIBUTIONS:', { x: width / 2 + 20, y: yPosition, size: 9, font: helveticaBold, color: grayColor });
    
    yPosition -= 20;
    page.drawText(memberData?.name || 'Valued Network Member', { x: 70, y: yPosition, size: 14, font: helveticaBold, color: darkColor });
    page.drawText(`$${totalAmount.toFixed(2)}`, { x: width / 2 + 20, y: yPosition, size: 18, font: helveticaBold, color: primaryColor });
    
    yPosition -= 15;
    page.drawText(memberData?.email || '', { x: 70, y: yPosition, size: 10, font: helvetica, color: grayColor });
    
    yPosition -= 50; // Escaping the informational box natively

    // IRS Mandatory Disclaimer Text natively integrated without harsh formatting
    const disclaimer = "No goods or services were provided by the organization in return for the contributions documented below.";
    page.drawText(disclaimer, { x: 50, y: yPosition, size: 10, font: timesRoman, color: grayColor });
    yPosition -= 15;
    page.drawText("Please retain this official document safely for your standard tax records.", { x: 50, y: yPosition, size: 10, font: helveticaBold, color: darkColor });
    
    yPosition -= 45;

    // Itemized Ledger Header
    page.drawText('ITEMIZED CONTRIBUTION RECORD', { x: 50, y: yPosition, size: 12, font: helveticaBold, color: darkColor });
    yPosition -= 10;
    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: width - 50, y: yPosition }, thickness: 2, color: darkColor });
    yPosition -= 20;
    
    // Responsive Table Data Columns
    page.drawText('DATE', { x: 50, y: yPosition, size: 9, font: helveticaBold, color: grayColor });
    page.drawText('TRANSACTION ID', { x: 130, y: yPosition, size: 9, font: helveticaBold, color: grayColor });
    page.drawText('AMOUNT', { x: 480, y: yPosition, size: 9, font: helveticaBold, color: grayColor });
    yPosition -= 15;

    // Map strict ordering chronologically directly parsing string payloads
    const sortedTransactions = [...activeTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Iterate printing dynamic rows safely jumping page arrays mathematically
    for (const tx of sortedTransactions) {
      if (yPosition < 60) addNewPage(); // Page break evaluation organically
      
      const safeTxDate = new Date(tx.date).toLocaleDateString();
      const safeTxId = tx.stripeSessionId ? String(tx.stripeSessionId) : 'Manual Record';
      const safeTxAmt = `$${(tx.amount || 0).toFixed(2)}`;

      page.drawText(safeTxDate, { x: 50, y: yPosition, size: 10, font: helvetica, color: darkColor });
      page.drawText(safeTxId, { x: 130, y: yPosition, size: 8.5, font: helvetica, color: grayColor }); 
      page.drawText(safeTxAmt, { x: 480, y: yPosition, size: 10, font: helveticaBold, color: darkColor });
      
      yPosition -= 20;
      page.drawLine({ start: { x: 50, y: yPosition + 10 }, end: { x: width - 50, y: yPosition + 10 }, thickness: 0.5, color: rgb(0.93, 0.93, 0.93) });
    }

    // Output the massive binary PDF block natively as a buffer explicitly
    const pdfBytes = await pdfDoc.save();

    // Construct precise Header configuration seamlessly streaming the array buffer natively
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${churchData?.name.replace(/\s+/g, '_')}_${year}_Tax_Statement.pdf"`,
      },
    });

  } catch (err: any) {
    console.error("PDF Compilation System Error:", err);
    return NextResponse.json({ error: 'Internal compilation schema exception.' }, { status: 500 });
  }
}
