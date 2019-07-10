var http = require("http");
var express=require("express");
var app=express();
var server = http.createServer(app).listen(3000);
var io=require("socket.io")(server);
var bcrypt=require("bcrypt");
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
var rooms={
	testroom:{
		passHash:'$2b$10$EvTUHZGyQSC.jpPKhquaYOk5r9mc.fZTlThEdVy/0CAA7eUNKHXOO',
		active:0
	}
}

async function authorize(authObject,socket){
	if(rooms.hasOwnProperty(authObject.room)){
		console.log(authObject.password,rooms[authObject.room].passHash);
		const match = await bcrypt.compare(authObject.password,rooms[authObject.room].passHash);
		if(match){
			socket.join(authObject.room);
			socket.emit('authOk',`Joining Room ${authObject.room}`);
		}else{
			socket.emit('authError');
			console.log('incorrect roomkey');
		}
	}else{
		console.log('room does not exist')
		socket.emit('authError');
	}
}


io.on("connection",function(socket){
	socket.on("auth",function(message){
		console.log(socket.id)
		authorize(JSON.parse(message),socket);
	});
	socket.on("chat",function(message){
		console.log(`chat: ${message}`);
		socket.emit('message',message)
	})
	socket.emit('message','socket is active');
});

console.log("starting socket app on pport 3000")