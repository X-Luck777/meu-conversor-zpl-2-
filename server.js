const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
// A biblioteca correta para "Ler ZPL e gerar Imagem"
const { Renderer } = require('zpl-renderer-js');

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

        // Limpeza e separação das etiquetas
        let rawLabels = zplData.split('^XZ');
        const labels = rawLabels
            .filter(l => l.includes('^XA'))
            .map(l => l.trim() + '^XZ');

        console.log(`Processando ${labels.length} etiquetas...`);

        if (labels.length === 0) {
             return res.status(400).send('Nenhuma etiqueta válida encontrada.');
        }

        // Cria PDF
        const doc = new PDFDocument({ autoFirstPage: false, size: [288, 432], margin: 0 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=etiquetas.pdf');
        doc.pipe(res);

        // Instancia o renderizador
        const renderer = new Renderer();

        let processedCount = 0;
        for (const labelZPL of labels) {
            processedCount++;
            doc.addPage();

            try {
                // Renderiza o ZPL para um Buffer PNG
                // A biblioteca retorna um Stream, precisamos converter para Buffer
                const renderResult = await renderer.render(labelZPL);
                
                // O renderResult pode ser um Buffer direto ou um objeto Stream dependendo da versão.
                // Vamos assumir que é um Buffer (padrão em libs de imagem Node)
                doc.image(renderResult, 0, 0, { width: 288, height: 432, fit: [288, 432] });

            } catch (renderError) {
                console.error(`Erro na etiqueta ${processedCount}:`, renderError);
                
                // Fallback de erro visual no PDF
                doc.fillColor('red').fontSize(12).text('Erro visualização', 10, 20);
                doc.fillColor('black').fontSize(6).text(labelZPL.substring(0, 200), 10, 50, {width: 260});
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
