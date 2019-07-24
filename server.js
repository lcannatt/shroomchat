var http = require("http");
var express=require("express");
var app=express();
var server = http.createServer(app).listen(3000);
var io=require("socket.io")(server);
var bcrypt=require("bcrypt");
var crypto=require("crypto");
var openpgp=require("openpgp");
// var fs=require('fs');
var path=require('path');

app.use(express.static("./public"));

//Routing
app.get('/room/:id',function(req,res){
	res.sendFile(path.join(__dirname,'private','room.html'));
});
app.get('/scripts/socket.io.js',function(req,res){
	res.sendFile(path.join(__dirname,'node_modules','socket.io-client','dist','socket.io.js'));
});
app.get('/scripts/openpgp.min.js',function(req,res){
	res.sendFile(path.join(__dirname,'node_modules','openpgp','dist','openpgp.min.js'));
});
app.get('/scripts/sha3.min.js',function(req,res){
	res.sendFile(path.join(__dirname,'node_modules','js-sha3','build','sha3.min.js'));
});


var hour=60*60*1000;//ms for unused cleanup
//Socket handling
var rooms={//initialized with room for testing.
	testroom:{
		salt:'e27b79c799253a0aa42579fb5c804586',
		passHash:'$2b$10$zDRkdwmlTCeR.wNc8nw.WOPzsUE2C7XQm9PHD/2RCG.NkYgQa.WUS',
		internalKey:crypto.randomBytes(32).toString('base64'),
		sockets:[],
		active:1,
		created:new Date(),
		msgCount:0
	}
}
console.log(rooms);
function prune(){
	console.log('Pruning unused rooms');
	let now=new Date();
	for(room in rooms){
		if(rooms[room].active===0 && now-rooms[room].created>hour){
			console.log(`Deleting ${room}`);
			delete rooms[room];
		}
	}
	setTimeout(prune,hour/12)
}
setTimeout(prune,0);

/*
Socket tracking array:
property=socket.id {
	name:stored nickname,
	rooms:[room names socket has joined]
}
*/
var sockets={};

async function authorize(authObject){
	if(rooms.hasOwnProperty(authObject.room)){
		const match = await bcrypt.compare(authObject.password,rooms[authObject.room].passHash);
		if(match){
			console.log('auth ok')
			return true;
		}else{
			console.log('incorrect roomkey');
			return false;
		}
	}else{
		console.log('room does not exist')
		return false;
	}
}

function generateSalt(){
	return crypto.randomBytes(32).toString('hex').slice(0,32);
}
async function newId(){
	let random = crypto.randomBytes(8).toString('base64').replace('/','@');
	if(rooms.hasOwnProperty([random])){
		random = await newId();
	}
	return random;
}
//pgp encrypt string wrapper
async function encrypt(msg,pwd){
	let options={
		message:openpgp.message.fromText(msg),
		passwords:[pwd]
	}
	return(openpgp.encrypt(options));
}
//pgp decrypt string wrapper
async function decrypt(pgpString,pwd){

	let message = await openpgp.message.readArmored(pgpString);
	let sk= await openpgp.decryptSessionKeys({
		message:message,
		passwords:pwd
	});
	let dc= await openpgp.decrypt({
		sessionKeys:sk[0],
		message:message
	})
	return dc.data;

}
function disconnectCleanup(socket){
	if(sockets.hasOwnProperty(socket.id)){
		sockets[socket.id].rooms.forEach(function(name){
			socket.to(name).emit('status',`${sockets[socket.id].name} left the room`)
			if(rooms.hasOwnProperty(name)){
				rooms[name].active-=1; //Update room member counters
				rooms[name].sockets=rooms[name].sockets.filter(id => id!=socket.id);
				if(rooms[name].active==0){
					delete rooms[name]; //Delete room if empty
				}
			}
		});
		delete sockets[socket.id];
		//prume this socket from socket list.
	}
	return true;
}
async function synchronizeHistory(socket,authObject){
	let id=socket.id;
	let room=rooms[authObject.room];
	if(room.sockets.length>1&&room.sockets[0]!=socket){
		let data=await encrypt(id,room.internalKey);
		socket.to(`${room.sockets[0]}`).emit('history-request',JSON.stringify(data));
	}
}
io.on("connection",function(socket){
	socket.on("handshake",function(msg){
		let obj=JSON.parse(msg);
		if(rooms.hasOwnProperty(obj.id)){
			socket.emit("handshake",rooms[obj.id].salt)
		}else{
			socket.emit("handshake",generateSalt())
		}
	})
	socket.on('new',async function(message){
		let obj=JSON.parse(message);
		let hash=obj.passHash;
		let crypt=await bcrypt.hash(hash,10);
		let id=await newId();
		rooms[id]={
			salt:obj.salt,
			passHash:crypt,
			internalKey:crypto.randomBytes(32).toString('base64'),
			sockets:[],
			date:new Date(),
			active:0,
			msgCount:0
		}
		socket.emit('new',id);

	})
	socket.on("auth",async function(message){
		console.log(`Socket Authorizing - ${socket.id}`)
		let authObject=JSON.parse(message)
		//Validate room key for user
		let success=await authorize(authObject);
		if(success){
			//Let them start recieving messages from the room
			socket.join(authObject.room);
			//add this to the socket tracking object
			if(!sockets.hasOwnProperty(socket.id)){
				sockets[socket.id]={
					name:authObject.nickname,
					rooms:Array(authObject.room)
				}
			}else{
				sockets[socket.id].rooms.push(authObject.room);
			}
			let nicknames=[]
			rooms[authObject.room].sockets.forEach(id => nicknames.push(sockets[id]['name']));

			rooms[authObject.room].active+=1;
			rooms[authObject.room].sockets.push(socket.id);
			console.log(sockets);
			synchronizeHistory(socket,authObject);
			socket.emit('authOK',`Joined room ${nicknames.length>0?`with ${nicknames.toString().replace(',',', ')}`:''}`);
			socket.to(authObject.room).emit('status',`${authObject.nickname} joined the room`)
		}else{
			socket.emit('authError')
		}
	});
	socket.on("history-response",async function(payload){
		let obj=JSON.parse(payload);
		//authorize the socket for the room
		let authorized=await authorize(obj);
		//decrypt the requesting socket id
		if(authorized){
			let room=rooms[obj.room];
			let socketID=await decrypt(obj.data,room.internalKey);
			//send the pgp data to the requesting socket
			socket.to(socketID).emit('history-response',JSON.stringify(obj.hist));
		}

	});
	socket.on("chat",async function(message){
		console.log(`chat: ${message}`);
		let messageObject=JSON.parse(message);
		let authorized=await authorize(messageObject);
		
		if(authorized){
			let content=messageObject.message;
			content=JSON.stringify(content);
			socket.to(messageObject.room).emit('message',content);
			socket.emit('conf',content);		
		}
	});
	socket.on('logout', function(){
		disconnectCleanup(socket);
	});
	socket.on('disconnect', function(){
		disconnectCleanup(socket);
		console.log(`socket disconnecting - ${socket.id}`);
		console.log(rooms);
		console.log(sockets);
	});
});



console.log("starting socket app on port 3000")