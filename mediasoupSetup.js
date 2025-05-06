// mediasoupSetup.js
import mediasoup from 'mediasoup';

// Mediasoup variables
let worker;
let router;
const transports = new Map(); // Keep track of all transports
const producers = new Map();  // Keep track of all producers
const consumers = new Map();  // Keep track of all consumers

// Media codecs
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

// Create Mediasoup worker
export async function createMediasoupWorker() {
  try {
    worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    });
    
    console.log('Mediasoup worker created');
    
    worker.on('died', () => {
      console.error('Mediasoup worker died, exiting...');
      setTimeout(() => process.exit(1), 2000);
    });
    
    return worker;
  } catch (error) {
    console.error('Error creating mediasoup worker:', error);
    throw error;
  }
}

// Create Mediasoup router
export async function createMediasoupRouter() {
  try {
    if (!worker) {
      throw new Error('Worker not created');
    }
    
    router = await worker.createRouter({ mediaCodecs });
    console.log('Mediasoup router created');
    
    return router;
  } catch (error) {
    console.error('Error creating mediasoup router:', error);
    throw error;
  }
}

// Create WebRTC transport
export async function createWebRtcTransport(socketId, isProducer = false) {
  try {
    if (!router) {
      throw new Error('Router not created');
    }
    
    const transportOptions = {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    };
    
    const transport = await router.createWebRtcTransport(transportOptions);
    
    if (!transports.has(socketId)) {
      transports.set(socketId, { producer: null, consumer: null });
    }
    
    if (isProducer) {
      transports.get(socketId).producer = transport;
    } else {
      transports.get(socketId).consumer = transport;
    }
    
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
        if (isProducer) {
          transports.get(socketId).producer = null;
        } else {
          transports.get(socketId).consumer = null;
        }
      }
    });
    
    transport.on('close', () => {
      console.log('Transport closed');
      if (isProducer) {
        transports.get(socketId).producer = null;
      } else {
        transports.get(socketId).consumer = null;
      }
    });
    
    console.log(`Transport created for ${socketId} as ${isProducer ? 'producer' : 'consumer'}`);
    return transport;
  } catch (error) {
    console.error('Error creating WebRTC transport:', error);
    throw error;
  }
}

// Get producer transport for a socket
export function getProducerTransport(socketId) {
  return transports.get(socketId)?.producer || null;
}

// Get consumer transport for a socket
export function getConsumerTransport(socketId) {
  return transports.get(socketId)?.consumer || null;
}

// Store producer
export function setProducer(socketId, producer) {
  if (!producers.has(socketId)) {
    producers.set(socketId, new Map());
  }
  
  producers.get(socketId).set(producer.id, producer);
  
  producer.on('close', () => {
    producers.get(socketId)?.delete(producer.id);
  });
}

// Store consumer
export function setConsumer(socketId, consumer) {
  if (!consumers.has(socketId)) {
    consumers.set(socketId, new Map());
  }
  
  consumers.get(socketId).set(consumer.id, consumer);
  
  consumer.on('close', () => {
    consumers.get(socketId)?.delete(consumer.id);
  });
}

// Get producer by ID
export function getProducer(socketId, producerId) {
  return producers.get(socketId)?.get(producerId);
}

// Get consumer by ID
export function getConsumer(socketId, consumerId) {
  return consumers.get(socketId)?.get(consumerId);
}

// Get router capabilities
export function getRouterRtpCapabilities() {
  if (!router) {
    throw new Error('Router not created');
  }
  
  return router.rtpCapabilities;
}

// Clean up resources when a socket disconnects
export function cleanupSocketResources(socketId) {
  // Close and clean up all transports for this socket
  const socketTransports = transports.get(socketId);
  if (socketTransports) {
    if (socketTransports.producer) {
      socketTransports.producer.close();
    }
    if (socketTransports.consumer) {
      socketTransports.consumer.close();
    }
    transports.delete(socketId);
  }
  
  // Clean up producers
  if (producers.has(socketId)) {
    producers.delete(socketId);
  }
  
  // Clean up consumers
  if (consumers.has(socketId)) {
    consumers.delete(socketId);
  }
}

// Export the router for direct access if needed
export function getRouter() {
  return router;
}