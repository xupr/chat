function bindRoomEvents(socket){
	socket.on('joinedRooms', function(rooms){
		var $roomsList = $('#roomsList .list-group');
		for (var i = rooms.length - 1; i >= 0; i--) {
			$roomsList.append('<a class="list-group-item list-item-flex" href="#" data-roomid="'+rooms[i].roomid+'" data-roomname="'+rooms[i].roomName+'"><span class="list-text">'+rooms[i].roomName+'</span><span class="badge">0</span></a>');
		};
	});

	$('#roomSearch').on('input', function(){
		var patt = new RegExp('.*'+$(this).val()+'.*');
		$('#roomsList a').each(function(){
			if(!patt.test($(this).data('roomname')))
				$(this).hide(0);
			else
				$(this).show(0);
		});
	});

	$('#createRoom').click(function(){
		if(socket.username){
			socket.emit('createRoom', $('#roomName').val());
			$('#createRoom span').attr('class', 'glyphicon glyphicon-repeat glyphicon-spin');
			console.log('creating');
		}
	});

	socket.on('createdRoom', function(room){
		$('#rooms').append('\
			<div id="'+room.roomid+'" class="room" style="display:none">\
				<h3 class="center">Room - '+room.roomName+'</h3>\
				<div class="chat"></div>\
				<div class="input-group chat-input">\
					<textarea type="text" class="form-control text custom-control" placeholder="Enter message" style="resize:none"></textarea>\
					<span class="input-group-btn btn btn-default send input-group-addon" data-roomid="'+room.roomid+'">send</span>\
				</div>\
			</div>\
		');

		$('#createRoom span').attr('class', 'glyphicon glyphicon-plus');

		slide(room.roomid, 'room', true);
	});

	socket.on('joinedRoom', function(room){
		if(0 === $('#roomsList .list-group a[data-roomid='+room.roomid+']').length)
			$('#roomsList .list-group').append('<a class="list-group-item list-item-flex" href="#" data-roomid="'+room.roomid+'" data-roomname="'+room.roomName+'"><span class="list-text">'+room.roomName+'</span><span class="badge">0</span></a>');
		if(room.admin){
			$('#roomsList .list-group a[data-roomid='+room.roomid+']').data('admin', 'true');
			$('.seperator').show(0)
			$('.add-to-group').show(0);
			$('.addUserButton').show(0);
		}
		var users = $('#roomsList .list-group a[data-roomid='+room.roomid+']').data('users');
		$('#usersInRoom a').each(function(){
			$(this).appendTo($('#usersNotInRoom'));
		});
		if(users && users.length > 0){
			var $list = $('#usersInRoom');
			for (var i = users.length - 1; i >= 0; i--) {
				$('.list-group-item[data-username='+users[i]+']').appendTo($list);
			};
		}
		sortUsers();
	});

	$('#roomsList').on('click', '.list-group-item', function(){
		var $newRoom = $(this);
		if(!$newRoom.hasClass('active')){
			if($('#'+$newRoom.data('roomid')).length === 0){
				$('#rooms').append('\
					<div id="'+$newRoom.data('roomid')+'" class="room" style="display:none">\
						<h3 class="center">Room - '+$newRoom.children('.list-text').html()+'</h3>\
						<span class="glyphicon glyphicon-repeat glyphicon-spin glyphicon-large"></span>\
						<div class="chat" style="display: none"></div>\
						<div class="input-group chat-input">\
							<textarea type="text" class="form-control text custom-control" placeholder="Enter message" style="resize:none"></textarea>\
							<span class="input-group-btn btn btn-default send input-group-addon" data-roomid="'+$newRoom.data('roomid')+'">send</span>\
						</div>\
					</div>\
				');
				slide($newRoom.data('roomid'), 'room', $newRoom.data('admin'));
				socket.emit('joinRoom', $newRoom.data('roomid'));
			}else{
				slide($newRoom.data('roomid'), 'room', $newRoom.data('admin'));
			}
			sortRooms();
		}
	});
}