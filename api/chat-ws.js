export const config = {
  runtime: 'edge',
};

// hack.chat WebSocket 目标地址
const HACKCHAT_WS_URL = 'wss://hack.chat/chat-ws';

export default async function handler(request) {
  // 检查是否为WebSocket升级请求
  const upgrade = request.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response(JSON.stringify({
      error: 'WebSocket upgrade required',
      usage: 'Connect to wss://your-domain.com/chat-ws',
      status: 'ready'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // 创建WebSocket连接对
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // 连接到hack.chat
  let hackChatWs;

  try {
    hackChatWs = new WebSocket(HACKCHAT_WS_URL);

    // 等待hack.chat连接建立
    await new Promise((resolve, reject) => {
      hackChatWs.onopen = resolve;
      hackChatWs.onerror = reject;

      // 10秒超时
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    console.log('Connected to hack.chat');

    // 设置消息转发：客户端 -> hack.chat
    server.addEventListener('message', (event) => {
      if (hackChatWs.readyState === WebSocket.OPEN) {
        hackChatWs.send(event.data);
      }
    });

    // 设置消息转发：hack.chat -> 客户端
    hackChatWs.addEventListener('message', (event) => {
      if (server.readyState === WebSocket.OPEN) {
        server.send(event.data);
      }
    });

    // 处理连接关闭
    server.addEventListener('close', () => {
      console.log('Client disconnected');
      if (hackChatWs.readyState === WebSocket.OPEN) {
        hackChatWs.close();
      }
    });

    hackChatWs.addEventListener('close', () => {
      console.log('hack.chat disconnected');
      if (server.readyState === WebSocket.OPEN) {
        server.close();
      }
    });

    // 错误处理
    server.addEventListener('error', (error) => {
      console.error('Client WebSocket error:', error);
      if (hackChatWs.readyState === WebSocket.OPEN) {
        hackChatWs.close();
      }
    });

    hackChatWs.addEventListener('error', (error) => {
      console.error('hack.chat WebSocket error:', error);
      if (server.readyState === WebSocket.OPEN) {
        server.close();
      }
    });

    // 接受WebSocket连接
    server.accept();

  } catch (error) {
    console.error('Failed to connect to hack.chat:', error);
    server.close(1011, 'Failed to connect to upstream server');
  }

  // 返回WebSocket响应
  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}
