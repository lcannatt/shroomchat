'use strict';
(function(){
	if (!Array.prototype.last){
		Object.defineProperty(Array.prototype, 'last',{
			value:function(){
				return this[this.length - 1];
			},
			enumerable:false
		});
	}
	if(!Array.prototype.sparseIndexOf){
		Object.defineProperty(Array.prototype,'sparseIndexOf',{
			value:function sparseIndexOf(value) {
				return Object.keys(this).find(k => this[k] === value);
			},
			enumerable:false
		});
	}

	/*
	*
	* Init
	*
	*/
	var salt; //set in socket handshake
	var roomId;// must be set before initiating handshake 
	var localNick;
	var hash;
	var pwd;//Global, set by hashauth(), logout(), read by encrypt(),hashauth()
	var chatInit=false;
	var socket;
	var history=Array();
	//subscripted by timestamp
	//History Object format=[
	//	[timestamp]:{
	//		isMessage:bool
	//		isSelf:bool
	//		entry:{message object}
	//		}...
	//	]
	var queue=[];//Added to by sendChat(), deleted from by socketchecked by initSocket.checkDropped()
	//Queue object tracks unconfirmed messages
	//format = {
	//	[timestamp]:{message object}
	//	}
	function addToHistory(entry,isMsg,options={}){
		let {isSelf,override,timestamp} = options;
		isSelf=isSelf?isSelf:true;
		override=override?override:false;
		timestamp=timestamp?timestamp:Date.now();
		//Wrapper for adding entry to history
		let id=entry.hasOwnProperty('timestamp')?entry.timestamp:timestamp;
		if(!override){
			while(history.hasOwnProperty(id)){
				id++;
			}
		}
		history[id]={
			isMessage:isMsg,
			isSelf:isSelf,
			entry:entry
		};
		console.log(history);
	}
	/*
	*
	* SOCKET MANAGEMENT
	*
	*/
	function initSocket(){// create socket instance, set up listeners\
		socket = io(window.location.origin);
		socket.on("connect",function(){
			console.log("connection opened");
			socket.emit('handshake',JSON.stringify({id:roomId}));
		});
		socket.on("disconnect",function(){
			addToHistory('Server disconnected',false);
			displayStatus('Server disconnected');
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
			addToHistory(data,true,{isSelf:false});
			console.log('History: ',history);
			displayMsg(data,false);
		});
		socket.on("authError",function(){
			console.log("cant auth")
		});
		socket.on("authOK",function(message){
			addToHistory(message,false);
			openChat(message);
			
		});
		socket.on('status',function(status){
			addToHistory(status,false);
			displayStatus(status);
		});
		socket.on('history-request',async function(payload){
			let obj=JSON.parse(payload);
			obj.hist=await(
				encrypt(
					JSON.stringify(
						history.filter(
							element => element['isMessage']
							).map(
								element => element.entry
							)
						)
					)
				);
			obj.room=roomId;
			obj.password=hash;
			console.log('Sending history:',obj);
			socket.emit('history-response',JSON.stringify(obj));
		});
		socket.on('history-response', async function(payload){
			let obj= JSON.parse(payload);
			let data=await decrypt(obj);
			console.log('Recieved history:');
			for(const id in data){
				addToHistory(data[id],true);
			}
		});
		socket.on('conf',async function(payload){
			let obj=JSON.parse(payload);
			let data=await decrypt(obj);
			if(queue[data.timestamp]){
				delete queue[data.timestamp];
				console.log('Recieved Message Confirmation. ');
			}
		});
		function checkDropped(){
			//Cleanup function,identifies failed message sends, informs user
			let oneMin=1000*30;//minute in ms
			for(const timestamp in queue){
				if(Date.now()-timestamp>oneMin){
					let message=Object.values(history).filter(
						msg => msg.entry.hasOwnProperty('timestamp') && msg.isSelf && msg.entry.timestamp==timestamp
						).reduce((a,c)=> c);
					let id=history.sparseIndexOf(message);
					delete queue[timestamp];
					addToHistory('This Message Could not be sent',false,{timestamp:id})
				}
			}
			setTimeout(checkDropped,oneMin);
		}
		checkDropped();
	}
	
	
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
		console.log('Sending Message:',data);
		queue[formatted.timestamp]=formatted;
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
		}
		displayStatus(message);
		document.querySelector('#message').focus();
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
				//Disable further input
				e.target.disabled=true;
				let textinput=document.querySelector('#message')
				textinput.disabled=true;
				//Send message via socket.
				let data=await sendChat()
				if(data){
					//update data model
					addToHistory(data,true,{isSelf:true});
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
	if(window.location.pathname.includes('room')){
		roomId=window.location.pathname.split('/').last();
		initSocket();
		document.querySelector('#roomid').innerText=roomId;
		document.addEventListener("submit",function(event){
			event.preventDefault();
			if(event.target.id==="room-login"){
				hashauth();
			}
		});
	}

})();