import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const WORLD = { width: 1200, height: 720 };
const MAX_PLAYERS = 8;
const rooms = new Map();
const obstacles = [
  {x:260,y:130,w:120,h:70},{x:510,y:280,w:180,h:65},
  {x:810,y:120,w:90,h:150},{x:170,y:470,w:200,h:55},
  {x:780,y:480,w:170,h:70},{x:1010,y:330,w:90,h:80}
];
const colors = ['#ff6685','#ffd166','#06d6a0','#4cc9f0','#c77dff','#f78c6b','#90be6d','#f72585'];
const cleanName = v => String(v || 'Runner').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,16) || 'Runner';
const newCode = () => Math.random().toString(36).slice(2,6).toUpperCase();

app.use(express.static(path.join(root,'public')));
app.get('/health',(_req,res)=>res.json({ok:true,rooms:rooms.size}));
function snapshot(room) {
  return {code:room.code,started:room.started,endsAt:room.endsAt,world:WORLD,obstacles,
    players:[...room.players.values()].map(({id,name,x,y,color,finished,place})=>({id,name,x,y,color,finished,place}))};
}
function broadcast(room){io.to(room.code).emit('state',snapshot(room));}
function join(socket,code,name){
  const room=rooms.get(code);
  if(!room)return socket.emit('notice','Room not found. Check the code.');
  if(room.started)return socket.emit('notice','This race has already started.');
  if(room.players.size>=MAX_PLAYERS)return socket.emit('notice','Room is full (8 players maximum).');
  const slot=room.players.size;
  room.players.set(socket.id,{id:socket.id,name:cleanName(name),x:70,y:100+slot*56,color:colors[slot%colors.length],finished:false,place:null,input:{x:0,y:0}});
  socket.join(code);socket.data.roomCode=code;
  socket.emit('joined',{code,id:socket.id});broadcast(room);
}
io.on('connection',socket=>{
  socket.on('create-room',({name}={})=>{
    let code=newCode();while(rooms.has(code))code=newCode();
    rooms.set(code,{code,players:new Map(),started:false,endsAt:0});join(socket,code,name);
  });
  socket.on('join-room',({code,name}={})=>join(socket,String(code||'').trim().toUpperCase(),name));
  socket.on('start-race',()=>{
    const room=rooms.get(socket.data.roomCode);if(!room||room.started||!room.players.size)return;
    room.started=true;room.endsAt=Date.now()+120000;
    [...room.players.values()].forEach((p,i)=>{p.x=70;p.y=100+i*56;p.finished=false;p.place=null;p.input={x:0,y:0};});
    io.to(room.code).emit('race-started',{duration:120});broadcast(room);
  });
  socket.on('input',input=>{
    const room=rooms.get(socket.data.roomCode),p=room?.players.get(socket.id);
    if(!p||!room.started||p.finished)return;
    p.input={x:Number.isFinite(input?.x)?Math.max(-1,Math.min(1,input.x)):0,y:Number.isFinite(input?.y)?Math.max(-1,Math.min(1,input.y)):0};
  });
  socket.on('disconnect',()=>{
    const code=socket.data.roomCode,room=rooms.get(code);if(!room)return;
    room.players.delete(socket.id);if(!room.players.size)rooms.delete(code);else broadcast(room);
  });
});
setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values()){
    if(!room.started)continue;
    for(const p of room.players.values()){
      if(p.finished)continue;
      const nx=Math.max(22,Math.min(WORLD.width-22,p.x+p.input.x*10.5));
      const ny=Math.max(22,Math.min(WORLD.height-22,p.y+p.input.y*10.5));
      const hit=obstacles.some(o=>nx+13>o.x&&nx-13<o.x+o.w&&ny+13>o.y&&ny-13<o.y+o.h);
      if(!hit){p.x=nx;p.y=ny;}
      if(p.x>=WORLD.width-58&&p.y>=WORLD.height/2-75&&p.y<=WORLD.height/2+75){
        p.finished=true;p.place=[...room.players.values()].filter(q=>q.finished).length-1;
      }
    }
    if(now>=room.endsAt){room.started=false;io.to(room.code).emit('race-ended');}
    broadcast(room);
  }
},50);
server.listen(PORT,()=>console.log('Chaos Run listening on port '+PORT));