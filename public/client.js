(function(){
	if (!Array.prototype.last){
		Array.prototype.last = function(){
			return this[this.length - 1];
		};
	};

	/*
	*
	* Init
	*
	*/
	var salt; //set in socket handshake
	var roomId=window.location.pathname.split('/').last();
	var localNick;
	var hash;
	var pwd;//Global, set by hashauth(), logout(), read by encrypt(),hashauth()
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
		displayStatus('Server disconnected.');
	});
	socket.on('handshake',function(serverSalt){
		salt=serverSalt;
		console.log('room hash salt recieved from server: '+salt);
		if(chatInit){
			hashauth();
		}
	})
	socket.on("message",async function(payload){
		let pgpObject=JSON.parse(payload);
		let data = await decrypt(pgpObject);
		displayMsg(data,false);
	});
	socket.on("authError",function(){
		console.log("cant auth")
	});
	socket.on("authOK",function(message){
		openChat(message);
		
	});
	socket.on('status',function(status){
		displayStatus(status);
	});
	
	async function sendChat(){//
		let input=document.querySelector('#message');
		let encrypted='';
		let formatted;
		if(input&&input.value.trim()!=''){
			formatted={
				nickname:localNick,
				timestamp:Date.now(),
				message:input.value,
			};
			encrypted=await encrypt(JSON.stringify(formatted));
		}else{
			return false;
		}
		let data={
			room:roomId,
			password:hash,
			message:encrypted
		}
		console.log(data);
		socket.emit('chat',JSON.stringify(data));
		return formatted;
	}
	/*
	*
	* Crypto functions
	*
	*/

	//Room Authorization
	function hashauth(){
		pwd=document.querySelector('#password').value;
		let nickInput=document.getElementById('nick');
		localNick=(nickInput.value!='')?nickInput.value:'Anonymous';
		hash=sha3_256(pwd+salt);
		console.log('calculated server roomkey using sha3_256 with room salt: "'+hash+'"')
		socket.emit('auth',JSON.stringify({
			room:roomId,
			nickname:localNick,
			password:hash
		}))
	}
	//pgp encryption
	async function encrypt(msg){
		let options={
			message:openpgp.message.fromText(msg),
			passwords:[pwd]
		}
		return(openpgp.encrypt(options));
	}
	//pgp decryption
	async function decrypt(pgpObject){
		let message = await openpgp.message.readArmored(pgpObject.data)
		let sk= await openpgp.decryptSessionKeys({
			message:message,
			passwords:pwd
		});
		let dc= await openpgp.decrypt({
			sessionKeys:sk[0],
			message:message
		})
		return JSON.parse(dc.data);

	}



	/*
	*
	* chat client
	*
	*/
	function openChat(message){
		
		let login=document.getElementById('login');
		let nickInput=document.getElementById('nick')
		let main=document.getElementById('main');
		localNick=(nickInput.value!='')?nickInput.value:'Anonymous';
		login.classList.add('nodisplay');
		main.classList.remove('nodisplay');
		if(!chatInit){
		initChatListeners();
		chatInit=true;
		}else{
			displayStatus('Server reconnected.');
		}
		displayStatus(message);
		document.querySelector('#messages').focus();
		

	}
	function clearInput(){
		let input=document.querySelector('#message');
		if(input){
			input.value='';
		}
	}
	
	function displayMsg(data,self){
		let {nickname,timestamp,message}=data;
		let wrapper=TPR_GEN.newElement('div',{className:'chat-wrapper'})
		let chat=TPR_GEN.newElement('div',{className:`chat ${(self)?'self':'other'}`});
		let header=TPR_GEN.newElement('div',{className:'chat-header clear'});
		let nickSpan=TPR_GEN.newElement('div',{
			className:'float-l nickname',
			innerText:nickname
		});
		header.appendChild(nickSpan);
		let dateObj=new Date(timestamp);
		let timeSpan=TPR_GEN.newElement('div',{
			className:'float-r timestamp',
			innerText:dateObj.toLocaleString()
		});
		header.appendChild(timeSpan);
		chat.appendChild(header);
		let body=TPR_GEN.newElement('div',{
			className:'chat-body clear',
			innerText:message
		})
		chat.appendChild(body);
		wrapper.appendChild(chat);
		let content=document.querySelector('#messages-content');
		if(content){
			content.appendChild(wrapper);
		}
		wrapper.scrollIntoView();
	}
	function displayStatus(status){
		let wrapper=TPR_GEN.newElement('div',{className:'chat-wrapper'})
		let statusDiv=TPR_GEN.newElement('div',{className:'status-update',innerText:status});
		wrapper.appendChild(statusDiv);
		let content=document.querySelector('#messages-content');
		if(content){
			content.appendChild(wrapper);
		}
		wrapper.scrollIntoView();
		
	}
	function logout(){
		let loginForm=document.querySelector('#room-login');
		socket.emit('logout');
		loginForm.reset();
		loginForm.closest('#login').classList.remove('nodisplay');
		document.querySelector('#main').classList.add('nodisplay');
		

	}
	function initChatListeners(){	
		document.addEventListener('keyup',function(e){
			if(e.key==="Enter"&&!e.shiftKey){
				e.preventDefault();
				let send=document.querySelector('#send');
				if(send){
					send.click();
				}
			}
		});
		document.addEventListener('keydown',function(e){
			if(e.key==="Enter"&&!e.shiftKey){
				e.preventDefault;
			}
		})
		document.addEventListener('click',async function(e){
			if(e.target.id==="send"){
				e.target.disabled=true;
				let textinput=document.querySelector('#message')
				textinput.disabled=true;
				let data=await sendChat()
				if(data){
					displayMsg(data,true);
				}
				clearInput();
				textinput.disabled=false;
				textinput.focus();
				e.target.disabled=false;
			}
			else if(event.target.id=='logout'){
				logout();
			}
		});
	}

	/*
	*
	* INIT
	*
	*/
	document.querySelector('#roomid').innerText=roomId;
	document.addEventListener("click",function(event){
		if(event.target.id==="auth"){
			console.log(event);
			hashauth();
		}
	});

	/*
	*
	* Testing
	*
	*/
	// document.querySelector('#password').value='test';
	// socket.on("handshake",hashauth);
})();