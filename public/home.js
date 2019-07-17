(function(){
	var socket;
	var roomId;
	var salt;
	function initSocket(){
		socket = io(window.location.origin);
		socket.on("connect",function(){
			console.log("connection opened");
			socket.emit('handshake',JSON.stringify({id:roomId}));
		});
		socket.on("disconnect",function(){
			console.log('Server socket disconnected');
		});
		socket.on('handshake',function(serverSalt){
			salt=serverSalt;
			console.log('room hash salt recieved from server: '+salt);
		});
		socket.on('new',function(data){
			window.location.href=window.location.origin+'/room/'+data;
		});
	}
	function toggleExpanded(element){
		if(!element.classList.contains('expander')){
			return false;
		}
		if(element.classList.contains('closed')){
			element.style.height=element.scrollHeight+'px';
		}else{
			element.style.height=0;
		}
		element.classList.toggle('closed');
		
	}
	function initUI(){
		document.querySelectorAll('.expander').forEach(function(elem){
			if(elem.classList.contains('closed')){
				elem.style.height=0;
			}else{
				elem.style.height=elem.scrollHeight+5+'px';
			}
		})
		document.addEventListener('click',function(e){
			if(e.target.id==='new-room'){
				let info=document.querySelector('#room-setup');
				if(info){
					toggleExpanded(e.target.closest('.expander'));
					toggleExpanded(info);
				}
				
			}else if(e.target.id==='create'&& !e.target.classList.contains('disabled')){
				createRoom();
				e.target.classList.add('disabled');
				document.querySelector('#password').disabled=true;
			}
		});
		document.addEventListener('keyup',function(e){
			if(e.target.id==='password'){
				let create=document.querySelector('#create');
				if(e.target.value!=''){
					create.classList.remove('disabled');
				}else{
					create.classList.add('disabled');
				}
			}
		})
		document.addEventListener('submit',function(e){
			if(e.target.id=='roomdata'){
				document.querySelector('#create').click();
			}
		})

	}
	function createRoom(){
		pwd=document.querySelector('#password').value;
		hash=sha3_256(pwd+salt);
		console.log('calculated server roomkey using sha3_256 with room salt: "'+hash+'"')
		socket.emit('new',JSON.stringify({
			passHash:hash,
			salt:salt
		}))
	}
	if(window.location.pathname==='/'){
		initSocket();
		initUI();
	}
})();