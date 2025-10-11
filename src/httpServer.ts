import Koa from 'koa';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// 创建 Koa 应用
const app = new Koa();

// 创建 HTTP 服务器
const server = createServer(app.callback());

const clients = new Set();

// 基于 HTTP 服务器创建 WebSocket 服务
const wss = new WebSocketServer({ server });

wss.on('connection', function connection(ws) {
  console.log('A new client connected!', ws);
  clients.add(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log('received: %s', data);

    
  });

  ws.send('Welcome to the WebSocket server based on Koa HTTP server!');

  clients.forEach(client => {
    (client as any).send('A new client has connected!');
  });
});

// 启动服务器
const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});