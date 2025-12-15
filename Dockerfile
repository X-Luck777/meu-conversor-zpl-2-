# 1. Define a imagem base. Usamos a versão 'bullseye' do Node
# porque ela é baseada em Debian, o que facilita a instalação
# de drivers gráficos (diferente da versão 'alpine' que é muito pelada).
FROM node:18-bullseye

# 2. Instala dependências do sistema operacional necessárias para
# manipulação de imagens (Canvas) e PDF.
# Sem isso, bibliotecas que convertem ZPL/Imagens vão falhar no Render.
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# 3. Define a pasta de trabalho dentro do container
WORKDIR /app

# 4. Copia primeiro apenas os arquivos de dependência.
# Isso é uma técnica de cache do Docker para deixar o deploy mais rápido.
COPY package*.json ./

# 5. Instala as dependências do Node (express, pdfkit, etc.)
RUN npm install

# 6. Copia o restante do código do seu projeto para o container
COPY . .

# 7. Informa ao Render que o container vai usar a porta 3000
EXPOSE 3000

# 8. O comando que inicia o seu servidor
CMD ["node", "server.js"]