const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const { createCanvas, Image } = require('canvas');
// Importamos a biblioteca de conversão ZPL
const Zpl = require('js-zpl');

const app = express();
const PORT = process.env.PORT || 3000;

// Limite alto para suportar muitas etiquetas e imagens
app.use(bodyParser.text({ limit: '200mb' }));
app.use(express.static('public'));

// Função auxiliar para converter ZPL string em Buffer PNG usando canvas
async function zplToPngBuffer(zplCode) {
    return new Promise((resolve, reject) => {
        try {
            // Configura o conversor (assumindo 203dpi, comum em Zebras)
            const zpl = new Zpl({
                canvas: createCanvas,
                Image: Image,
                dpi: 203,
                width: 4 * 203, // 4 polegadas de largura
                height: 6 * 203 // 6 polegadas de altura (ajuste se necessário)
            });

            // Converte e gera o buffer PNG
            zpl.convert(zplCode).then(canvas => {
                resolve(canvas.toBuffer());
            }).catch(err => {
                console.error("Erro na conversão ZPL interna:", err);
                // Se falhar, retorna um buffer vazio ou imagem de erro
                reject(err);
            });
        } catch (e) {
             reject(e);
        }
    });
}


app.post('/convert', async (req, res) => {
    try {
        const zplData = req.body;
        if (!zplData || zplData.trim().length === 0) {
            return res.status(400).send('Nenhum código ZPL recebido.');
        }

        // 1. Separar etiquetas. O split por ^XZ pode deixar lixo, limpamos.
        let rawLabels = zplData.split('^XZ');
        const labels = rawLabels
            .filter(l => l.includes('^XA')) // Garante que tem início
            .map(l => l.trim() + '^XZ'); // Adiciona o fim de volta

        console.log(`Iniciando processamento de ${labels.length} etiquetas.`);

        if (labels.length === 0) {
             return res.status(400).send('Nenhuma etiqueta válida encontrada (procure por ^XA e ^XZ).');
        }

        // 2. Criar documento PDF (Ajuste o tamanho se suas etiquetas não forem 4x6)
        // 4x6 polegadas = 288x432 points no PDFKit
        const doc = new PDFDocument({ autoFirstPage: false, size: [288, 432], margin: 0 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=etiquetas.pdf');
        doc.pipe(res);

        // 3. Processar cada etiqueta
        let processedCount = 0;
        for (const labelZPL of labels) {
            doc.addPage();
            processedCount++;

            try {
                console.log(`Renderizando etiqueta ${processedCount}/${labels.length}...`);
                // AQUI ESTÁ A MÁGICA: Converte ZPL para Imagem PNG
                const imgBuffer = await zplToPngBuffer(labelZPL);

                // Insere a imagem gerada no PDF, esticando para caber na página
                doc.image(imgBuffer, 0, 0, { width: 288, height: 432, fit: [288, 432] });

            } catch (renderError) {
                console.error(`Falha ao renderizar etiqueta ${processedCount}:`, renderError.message);
                // Se der erro na imagem, escreve um texto de erro no PDF para essa etiqueta
                doc.fillColor('red')
                   .fontSize(12)
                   .text(`Erro ao renderizar esta etiqueta: ${renderError.message}`, 10, 50);
                doc.fontSize(8).text(labelZPL.substring(0, 100), 10, 100, {width: 260});
            }
        }

        console.log("Finalizando PDF...");
        doc.end();

    } catch (error) {
        console.error("Erro geral no servidor:", error);
        if (!res.headersSent) {
            res.status(500).send('Erro ao processar ZPL: ' + error.message);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de etiquetas rodando na porta ${PORT}`);
});
