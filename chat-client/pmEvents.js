function bindPmEvents(socket){
	socket.on('PMs', function(PMs){
		var $newRoom = $('.list-group-item[data-username="'+PMs.username+'"]');
		var $privateChat = $('#to-'+PMs.username+' .chat');
		var PMs = JSON.parse('['+PMs.PMs+']');
		for (var i = PMs.length - 1; i >= 0; i--) {
			var message = PMs[i];
			var date = new Date(message.time);
			var minutes = '0'+date.getMinutes();
			minutes = minutes.substring(minutes.length-2,minutes.length);
			if(message.username === socket.username)
				$privateChat.append('<div class="message user"><div class="message-header-user"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+message.username+': </b></span></div><div class="message-text"><span class="message-span">'+message.text+'</span></div></div>');
			else
				$privateChat.append('<div class="message"><div class="message-header"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+message.username+': </b></span></div><div class="message-text"><span class="message-span">'+message.text+'</span></div></div>');
		};
		if($('#to-'+$newRoom.data('username')+'>span').length > 0){
			$('#to-'+$newRoom.data('username')+'>span').remove();
			if(!$(':animated').attr('id') === ((currentRoom.type === 'room')? '' : 'to-')+currentRoom.room){
				$privateChat.show('slide', {direction: 'up'}, 0);
				$privateChat.scrollTop($privateChat[0].scrollHeight);
			}else{
				$privateChat.show('slide', {direction: 'up'}, 200, function(){
					$privateChat.scrollTop($privateChat[0].scrollHeight);
				});
			} 
		}
	});

	$('#rooms').on('click', '.PM .send', function(){
		socket.emit('PM', {username: $(this).data('username'), text: $('#to-'+$(this).data('username')+' .text').val()});
		$('#to-'+$(this).data('username')+' .text').val('');
	});

	var shift = false;
	$('#rooms').on('keyup', '.PM .text', function(e){
		if(e.keyCode === 16)
			shift = false;
	});

	$('#rooms').on('keydown', '.PM .text', function(e){
		if(e.keyCode === 16)
			shift = true;
		if(e.keyCode === 13 && !shift){
			e.preventDefault();
			var username = $(this).parent().find('.send').data('username');
			console.log(username);
			console.log($(this)[0]);
			socket.emit('PM', {username: username, text: $(this).val()});
			$(this).val('');
		}
	});

	socket.on('PM', function(message){
		var username = ((message.from === socket.username)? message.to : message.from);
		if(message.from != socket.username)
			new Audio("notification.wav").play();
		if($('#to-'+username).length > 0){
			var $privateChat = $('#to-'+username+' .chat');
			var date = new Date(message.time);
			var minutes = '0'+date.getMinutes();
			minutes = minutes.substring(minutes.length-2,minutes.length);
			if(message.from === socket.username)
				$privateChat.append('<div class="message user"><div class="message-header-user"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+message.from+': </b></span></div><div class="message-text"><span class="message-span">'+message.text+'</span></div></div>');
			else
				$privateChat.append('<div class="message"><div class="message-header"><span class="message-span">['+date.getHours()+':'+minutes+'] <b>'+message.from+': </b></span></div><div class="message-text"><span class="message-span">'+message.text+'</span></div></div>');
			$privateChat.scrollTop($privateChat[0].scrollHeight);
		}
		
		if(!$('a[data-username='+username+']').hasClass('active')){
			$('a[data-username='+username+'] .badge').html(parseInt($('a[data-username='+username+'] .badge').html())+1);
			$('a[data-username='+username+']').addClass('notify');
			$('a[data-username='+username+']').prependTo($('a[data-username='+username+']').parent());
			$('a[data-username='+username+']')[0].dataset.time = message.time;
		}
		else
			socket.emit('seenMessages', 'to-'+((message.from === socket.username)? message.to : message.from));
	});
}