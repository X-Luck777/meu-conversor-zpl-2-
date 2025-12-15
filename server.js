const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const path = require('path');
// Nota: Em um cenário real de produção sem API, você precisaria de um parser ZPL robusto.
// Para este exemplo, usaremos uma lógica simplificada que converte o texto.
// Se as imagens forem críticas, bibliotecas como 'zpl-image' (baseada em node-canvas) são necessárias.

const app = express();
const PORT = process.env.PORT || 3000;

// AUMENTAR O LIMITE PARA SUPORTAR IMAGENS GRANDES E 150+ ETIQUETAS
app.use(bodyParser.text({ limit: '50mb' }));
app.use(express.static('public'));

app.post('/convert', async (req, res) => {
    try {
        const zplData = req.body;

        if (!zplData) {
            return res.status(400).send('Nenhum código ZPL recebido.');
        }

        // 1. Separar as etiquetas (ZPL usa ^XZ para terminar uma etiqueta)
        // O filter remove strings vazias causadas por quebras de linha extras
        const labels = zplData.split('^XZ').filter(l => l.trim().length > 10).map(l => l + '^XZ');

        console.log(`Processando ${labels.length} etiquetas...`);

        // 2. Criar o documento PDF
        // Tamanho padrão 4x6 polegadas (comum para Zebra), ajuste conforme necessário (ex: 100x150mm)
        const doc = new PDFDocument({ autoFirstPage: false });

        // Configurar cabeçalhos para download do PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=etiquetas.pdf');

        doc.pipe(res);

        // 3. Processar cada etiqueta
        for (const labelZPL of labels) {
            // Adiciona uma nova página para cada etiqueta
            // 4x6 polegadas = 288x432 points (72 points por polegada)
            doc.addPage({ size: [288, 432], margin: 0 });

            /**
             * ---------------------------------------------------------
             * LÓGICA DE RENDERIZAÇÃO "SEM API"
             * ---------------------------------------------------------
             * Aqui reside a maior complexidade. Renderizar ZPL cru (especialmente imagens ^GF)
             * requer um parser completo. Como não podemos usar APIs externas,
             * temos duas opções viáveis no Node:
             * * A. Usar uma lib que desenha no Canvas (ex: zpl-image).
             * B. Se for apenas texto/barras, desenhar direto no PDFKit.
             * * Abaixo, simulo a integração onde o ZPL é convertido.
             * Num caso real, você instanciaria o parser aqui.
             */
            
            // Exemplo simplificado de debug no PDF (pois parsers ZPL full open-source são complexos):
            doc.fontSize(10).text("ZPL Recebido (Renderização Simplificada):", 10, 10);
            doc.fontSize(6).text(labelZPL.substring(0, 200) + "...", 10, 30, { width: 260 });
            
            // NOTA: Para renderizar as imagens e códigos reais, você precisaria integrar
            // o módulo 'zpl-image' aqui, gerando um Buffer PNG e inserindo com:
            // const imageBuffer = await zplToPng(labelZPL);
            // doc.image(imageBuffer, 0, 0, { width: 288 });
        }

        doc.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao processar ZPL');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});