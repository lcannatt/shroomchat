(function(){
	if (!Array.prototype.last){
		Array.prototype.last = function(){
			return this[this.length - 1];
		};
	};


	var roomId=window.location.pathname.split('/').last();
	var nickname;
	
	/*
	*
	* SOCKET MANAGEMENT
	*
	*/

	var socket = io("localhost:3000");
	socket.on("connect",function(){
		console.log("connection opened");
		socket.emit('handshake',JSON.stringify({id:roomId}));
	});
	socket.on("disconnect",function(){
		console.log("disconnected");
	});
	socket.on('handshake',function(serverSalt){
		salt=serverSalt;
		console.log('room hash salt recieved from server: '+salt);
	})
	socket.on("message",function(payload){
		console.log(payload);
	});
	socket.on("authError",function(){
		console.log("cant auth")
	});
	socket.on("authOK",function(message){
		openChat();
	});
	/*
	*
	* Auth management
	*
	*/
	function hashauth(){
		let pwd=document.querySelector('#password').value;
		let hash=sha3_256(pwd+salt);
		console.log('calculated server roomkey using sha3_256 with room salt: "'+hash+'"')
		socket.emit('auth',JSON.stringify({
			room:roomId,
			password:hash
		}))
	}


	/*
	*
	* chat client
	*
	*/
	function openChat(){
		let login=document.getElementById('login');
		let nickInput=document.getElementById('nick')
		let main=document.getElementById('main');
		nickname=(nickInput.value!='')?nickInput.value:'Anonymous';
		login.classList.add('nodisplay');
		main.classList.remove('nodisplay');

	}

	/*
	*
	* Init
	*
	*/
	var salt;

	document.addEventListener("click",function(event){
		if(event.target.id==="auth"){
			console.log(event);
			hashauth();
		}
		if(event.target.id==="msg"){
			socket.emit('chat',JSON.stringify(message));
		}
	})
})();