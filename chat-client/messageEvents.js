function sortRooms(){
	if($('#roomsList a.notify').length > 0){
		$(tinysort('#roomsList a.notify', {data: 'time', order: 'asc'})).each(function(){
			$(this).prependTo($(this).parent());
		});
	}
}

function bindMessageEvents(socket){
	socket.on('allMessages', function(res){
		var roomid = res.roomid;
		if(res.messages)
			var messages = JSON.parse('['+res.messages+']');
		else var messages = [];
		var $chat = $('#'+roomid+' .chat')
		for (var i = messages.length - 1; i >= 0; i--) {
			var date = new Date(messages[i].time);
			var minutes = '0'+date.getMinutes();
			minutes = minutes.substring(minutes.length-2,minutes.length);
			if(messages[i].username === socket.username)
				$chat.append('<div class="message user"><div class="message-header-user"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+messages[i].username+': </b></span></div><div class="message-text"><span class="message-span">'+messages[i].text+'</span></div></div>');
			else
				$chat.append('<div class="message"><div class="message-header"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+messages[i].username+': </b></span></div><div class="message-text"><span class="message-span">'+messages[i].text+'</span></div></div>');
		};
		if($('#'+roomid+'>span').length > 0){
			$('#'+roomid+'>span').remove();
			if(!$(':animated').attr('id') === ((currentRoom.type === 'room')? '' : 'to-')+currentRoom.room){
				$chat.show('slide', {direction: 'up'}, 0);
				$chat.scrollTop($chat[0].scrollHeight);
			}else{
				$chat.show('slide', {direction: 'up'}, 200, function(){
					$chat.scrollTop($chat[0].scrollHeight);
				});
			}
		}
	});

	$('#rooms').on('click', '.room .send', function(){
		if(socket.username){
			var roomid = $(this).data('roomid');
			socket.emit('message', {text: $('#'+roomid+' .text').val(), roomid: roomid});
			$('#'+roomid+' .text').val('');
		}
	});
	var shift = false;
	$('#rooms').on('keyup', '.room .text', function(e){
		if(e.keyCode === 16)
			shift = false;
	});

	$('#rooms').on('keydown', '.room .text', function(e){
		if(e.keyCode === 16)
			shift = true;
		if(e.keyCode === 13 && !shift){
			e.preventDefault();
			var roomid = $(this).parent().find('.send').data('roomid');
			socket.emit('message', {text: $(this).val(), roomid: roomid});
			$(this).val('');
		}
	});

	socket.on('newMessages', function(newMessages){
		var times = newMessages.times;
		newMessages = newMessages.newMessages;
		for (var i = Object.keys(newMessages).length - 1; i >= 0; i--) {
			var id = Object.keys(newMessages)[i];
			if(id.substring(0,3) === 'to-'){
				var $ele = $('a[data-username='+id.substring(3,id.length)+']');	
			}else
				var $ele = $('a[data-roomid='+id+']');
			$ele.find('.badge').html((newMessages[id]==-1)? 0 : newMessages[id]);
			if(newMessages[id] > 0){
				$ele.addClass('notify');
				$ele[0].dataset.time = times[id];
			}
		};

		sortUsers();
		sortRooms();
	});

	socket.on('message', function(message){
		if(message.username != socket.username)
			new Audio("notification.wav").play();
		if($('#'+message.roomid).length != 0){
			var date = new Date(message.time);
			var minutes = '0'+date.getMinutes();
			minutes = minutes.substring(minutes.length-2,minutes.length);
			if(message.username === socket.username)
				$('#'+message.roomid+' .chat').append('<div class="message user"><div class="message-header-user"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+message.username+': </b></span></div><div class="message-text"><span class="message-span">'+message.text+'</span></div></div>');
			else
				$('#'+message.roomid+' .chat').append('<div class="message"><div class="message-header"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+message.username+': </b></span></div><div class="message-text"><span class="message-span">'+message.text+'</span></div></div>');
			$('#'+message.roomid+' .chat').scrollTop($('#'+message.roomid+' .chat')[0].scrollHeight);
		}
		if(!$('a[data-roomid='+message.roomid+']').hasClass('active')){
			$('a[data-roomid='+message.roomid+'] .badge').html(parseInt($('a[data-roomid='+message.roomid+'] .badge').html())+1);
			$('a[data-roomid='+message.roomid+']').addClass('notify');
			$('a[data-roomid='+message.roomid+']')[0].dataset.time = message.time;
		}else
			socket.emit('seenMessages', message.roomid);
		sortRooms();
	});
}