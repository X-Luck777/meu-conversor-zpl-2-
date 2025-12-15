const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
// Importamos a nova biblioteca 'zpl-image'
const zplImage = require('zpl-image');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.text({ limit: '200mb' }));
app.use(express.static('public'));

app.post('/convert', async (req, res) => {
    try {
        const zplData = req.body;
        if (!zplData || zplData.trim().length === 0) {
            return res.status(400).send('Nenhum código ZPL recebido.');
        }

        // Limpeza básica das etiquetas
        let rawLabels = zplData.split('^XZ');
        const labels = rawLabels
            .filter(l => l.includes('^XA'))
            .map(l => l.trim() + '^XZ');

        console.log(`Processando ${labels.length} etiquetas...`);

        if (labels.length === 0) {
             return res.status(400).send('Nenhuma etiqueta válida encontrada.');
        }

        // Cria PDF tamanho padrão 4x6" (288x432 points)
        const doc = new PDFDocument({ autoFirstPage: false, size: [288, 432], margin: 0 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=etiquetas.pdf');
        doc.pipe(res);

        let processedCount = 0;

        for (const labelZPL of labels) {
            processedCount++;
            doc.addPage();

            try {
                // A biblioteca zpl-image converte diretamente para Buffer PNG
                const imgBuffer = await zplImage(labelZPL);

                // Insere a imagem no PDF
                doc.image(imgBuffer, 0, 0, { width: 288, height: 432, fit: [288, 432] });
                
            } catch (renderError) {
                console.error(`Erro na etiqueta ${processedCount}:`, renderError.message);
                
                // Fallback: Se não conseguir desenhar a imagem, escreve o erro no PDF
                doc.fillColor('red')
                   .fontSize(10)
                   .text(`Erro de renderização visual`, 10, 20);
                
                doc.fillColor('black')
                   .fontSize(6)
                   .text(labelZPL.substring(0, 300), 10, 40, {width: 260});
            }
        }

        doc.end();

    } catch (error) {
        console.error("Erro fatal:", error);
        if (!res.headersSent) res.status(500).send('Erro no servidor.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
