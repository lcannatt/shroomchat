(function(){
	if (!Array.prototype.last){
		Array.prototype.last = function(){
			return this[this.length - 1];
		};
	};


	var roomId=window.location.pathname.split('/').last();
	var nickname;
	var hash;
	var pwd;//Global, set by hashauth(), read by encrypt(),hashauth()
	var chatInit=false;
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
	* Crypto Related
	*
	*/

	//Room Authorization
	function hashauth(){
		pwd=document.querySelector('#password').value;
		hash=sha3_256(pwd+salt);
		console.log('calculated server roomkey using sha3_256 with room salt: "'+hash+'"')
		socket.emit('auth',JSON.stringify({
			room:roomId,
			password:hash
		}))
	}
	//pgp encryption
	async function encrypt(msg){
		let options={
			message:openpgp.message.fromText(msg),
			passwords:[pwd],
		}
		return(openpgp.encrypt(options));
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
		if(!chatInit){initChatListeners();}

	}
	async function sendChat(){
		let input=document.querySelector('#message');
		let encrypted='';
		if(input){
			let formatted=JSON.stringify({
				nickname:nickname,
				timestamp:Date.now(),
				message:input.value,
			});
			encrypted=await encrypt(formatted);
		}
		let data={
			room:roomId,
			password:hash,
			message:encrypted
		}
		console.log(data);
		socket.emit('chat',JSON.stringify(data));
	}
	function initChatListeners(){
		document.addEventListener('keyup',function(e){
			if(e.key==="Enter"&&!e.shiftKey){
				let send=document.querySelector('#send');
				if(send){
					send.click();
				}
			}
		});
		document.addEventListener('click',function(e){
			if(e.target.id==="send"){
				sendChat();
			}
		});
		chatInit=true;
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

	/*
	*
	* Testing
	*
	*/
	document.querySelector('#password').value='test';
	socket.on("handshake",hashauth);
})();