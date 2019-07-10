(function(){
	if (!Array.prototype.last){
		Array.prototype.last = function(){
			return this[this.length - 1];
		};
	};

	var socket = io("localhost:3000");
	var authInfo={
		room:'testroom',
		password:'pass'
	}
	var message={msg:'poooop'};
	var roomId=window.location.pathname.split('/').last();
	console.log(roomId);
	socket.on("connect",function(){
		console.log("connection opened");
	});
	socket.on("disconnect",function(){
		console.log("disconnected");
	});
	socket.on("message",function(payload){
		console.log(payload);
	});
	socket.on("authError",function(){
		console.log("cant auth")
	})
	socket.on("authOK",function(message){
		console.log(message)
	})
	
	document.addEventListener("click",function(event){
		if(event.target.id==="auth"){
			socket.emit('auth',JSON.stringify(authInfo))
		}
		if(event.target.id==="msg"){
			socket.emit('chat',JSON.stringify(message));
		}
	})
})();