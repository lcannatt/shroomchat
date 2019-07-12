var http = require("http");
var express=require("express");
var app=express();
var server = http.createServer(app).listen(3000);
var io=require("socket.io")(server);
var bcrypt=require("bcrypt");
var crypto=require("crypto");
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



//Socket handling
var rooms={//initialized with room for testing.
	testroom:{
		salt:'e27b79c799253a0aa42579fb5c804586',
		passHash:'$2b$10$zDRkdwmlTCeR.wNc8nw.WOPzsUE2C7XQm9PHD/2RCG.NkYgQa.WUS',
		active:0
	}
}
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
function disconnectCleanup(socket){
	if(sockets.hasOwnProperty(socket.id)){
		sockets[socket.id].forEach(function(name){
			if(rooms.hasOwnProperty(name)){
				rooms[name].active-=1; //Update room member counters
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
io.on("connection",function(socket){
	socket.on("handshake",function(msg){
		obj=JSON.parse(msg);
		if(rooms.hasOwnProperty(obj.id)){
			socket.emit("handshake",rooms[obj.id].salt)
		}else{
			socket.emit("handshake",generateSalt())
		}
	})
	socket.on("auth",async function(message){
		console.log(`Socket Authorizing - ${socket.id}`)
		authObject=JSON.parse(message)
		let success=await authorize(authObject);
		if(success){
			socket.join(authObject.room);
			if(!sockets.hasOwnProperty(socket.id)){
				sockets[socket.id]=Array(authObject.room)
			}else{
				sockets[socket.id].push(authObject.room);
			}
			rooms[authObject.room].active+=1;
			console.log(sockets);
			socket.emit('authOK',`Joining room ${authObject.room}`);
		}else{
			socket.emit('authError')
		}
	});
	socket.on("chat",async function(message){
		console.log(`chat: ${message}`);
		let messageObject=JSON.parse(message);
		let authorized=await authorize(messageObject);
		let content=JSON.stringify(messageObject.message);
		if(authorized){
			console.log(`sending message to ${messageObject.room}`);
			socket.to(messageObject.room).emit('message',content);
			socket.emit('message',content)
		}
	})
	socket.on('disconnect', function(){
		disconnectCleanup(socket);
		console.log(`socket disconnecting - ${socket.id}`);
		console.log(rooms);
		console.log(sockets);
	})
});

console.log("starting socket app on port 3000")