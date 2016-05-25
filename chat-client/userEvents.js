function sortUsers(){
	if($('#usersInRoom .list-group-item:not(.notify)').length > 0)
		tinysort('#usersInRoom .list-group-item:not(.notify)', {data: 'logged'});
	if($('#usersInRoom .list-group-item[data-logged="0"]:not(.notify)').length > 0)
		tinysort('#usersInRoom .list-group-item[data-logged="0"]:not(.notify)', {data: 'username'});
	if($('#usersInRoom .list-group-item[data-logged="1"]:not(.notify)').length > 0)
		tinysort('#usersInRoom .list-group-item[data-logged="1"]:not(.notify)', {data: 'username'});
	if($('#usersNotInRoom .list-group-item:not(.notify)').length > 0)
		tinysort('#usersNotInRoom .list-group-item:not(.notify)', {data: 'class'});
	if($('#usersNotInRoom .list-group-item[data-logged="0"]:not(.notify)').length > 0)
		tinysort('#usersNotInRoom .list-group-item[data-logged="0"]:not(.notify)', {data: 'username'});
	if($('#usersNotInRoom .list-group-item[data-logged="1"]:not(.notify)').length > 0)
		tinysort('#usersNotInRoom .list-group-item[data-logged="1"]:not(.notify)', {data: 'username'});
	if($('#usersList a.notify').length > 0){
		$(tinysort('#usersList a.notify', {data: 'time', order: 'asc'})).each(function(){
			$(this).prependTo($(this).parent());
		});
	}
}

function bindUserEvents(socket){
	$('#usersList').on('click', 'a .addUserButton', function(e){
		e.stopPropagation();
		if(socket.username){
			var roomid = $('.list-group-item.active').data('roomid');
			var username = $(this).parent().data('username');
			socket.emit('adminAction', {username: username, roomid: roomid, action:(($(this).parent().parent().attr('id') === 'usersInRoom')? 'removeFromRoom' : 'addToRoom')});
		}
	});

	$('#userSearch').on('input', function(){
		var patt = new RegExp('.*'+$(this).val()+'.*');
		$('#usersList a').each(function(){
			if(!patt.test($(this).data('username')))
				$(this).hide(0);
			else
				$(this).show(0);
		});
	});

	socket.on('users', function(users){
		var $list = $('#usersList #usersNotInRoom.list-group');
		for (var i = users.length - 1; i >= 0; i--) {
			$list.append('\
				<a class="list-group-item '+((users[i].logged)? 'list-group-item-success' : 'list-group-item-danger')+'" href="#" data-username="'+users[i].username+'" data-logged="'+((users[i].logged)? '0' : '1')+'">\
					<div class="list-item-flex">\
						<span class="list-text">'+users[i].username+'</span>\
						<span class="badge">0</span>\
						<div class="seperator"></div>\
						<span class="glyphicon glyphicon-plus add-to-group"></span>\
					</div>\
					<div class="addUserButton"></div>\
				</a>\
			');
		};
	});

	socket.on('usersInRoom', function(users){
		users.users.splice(users.users.indexOf(socket.username), 1);
		$('.list-group-item[data-roomid='+users.roomid+']').data('users', users.users);
	});

	socket.on('userJoined', function(user){
		if(user.username != socket.username){
			if(!$('.list-group-item[data-roomid='+user.roomid+']').data('users'))
				$('.list-group-item[data-roomid='+user.roomid+']').data('users', [user])
			else
				$('.list-group-item[data-roomid='+user.roomid+']').data('users').push(user.username);
			if($('.list-group-item[data-roomid='+user.roomid+']').hasClass('active')){
				$('.list-group-item[data-username='+user.username+']').appendTo($('#usersInRoom'));
			}
			sortUsers();
		}
	});

	socket.on('userLeft', function(user){
		if(user.username != socket.username){
			$('.list-group-item[data-roomid='+user.roomid+']').data('users').splice($('.list-group-item[data-roomid='+user.roomid+']').data('users').indexOf(user.username), 1);
			if($('.list-group-item[data-roomid='+user.roomid+']').hasClass('active')){
				$('.list-group-item[data-username='+user.username+']').appendTo($('#usersNotInRoom'));
			}
			sortUsers();
		}
	});

	socket.on('banned', function(roomid){
		slide('general', 'room', false);
		setTimeout(function(){
			$('#'+roomid).remove();
			$('.list-group-item[data-roomid='+roomid+']').remove();
		}, 200);
	});

	socket.on('register', function(user){
		$('#usersList #usersNotInRoom.list-group').append('\
			<a class="list-group-item list-group-item-danger" href="#" data-username="'+user+'" data-logged="1">\
				<div class="list-item-flex">\
					<span class="list-text">'+user+'</span>\
					<span class="badge">0</span>\
					<div class="seperator"></div>\
					<span class="glyphicon glyphicon-plus add-to-group"></span>\
				</div>\
				<div class="addUserButton"></div>\
			</a>\
		');
		if($('#roomsList .list-group-item.active').data('admin')){
			$('.seperator').show();
			$('.add-to-group').show();
			$('.addUserButton').show();
		}
		sortUsers();
	});

	socket.on('logout', function(user){
		var $user = $('#usersList .list-group a[data-username='+user+']');
		new Audio('logout.wav').play();
		if($user.length > 0){
			$user.data('logged', 1);
			$user[0].dataset.logged = 1;
			$user.removeClass('list-group-item-success');
			$user.addClass('list-group-item-danger');
			sortUsers();
		}
	});

	socket.on('login', function(user){
		var $user = $('#usersList .list-group a[data-username='+user+']');
		$user.data('logged', 0);
		$user[0].dataset.logged = 0;
		new Audio('login.wav').play();
		$user.removeClass('list-group-item-danger');
		$user.addClass('list-group-item-success');
		sortUsers();
	});

	$('#usersList').on('click', 'a', function(){
		$('.seperator').hide(200)
		$('.add-to-group').hide(200);
		$('.addUserButton').hide(200);
		var $newRoom = $(this);
		if(!$newRoom.hasClass('active')){
			if($('#to-'+$newRoom.data('username')).length === 0){
				$('#rooms').append('\
					<div id="to-'+$newRoom.data('username')+'" class="PM" style="display: none">\
						<h3 class="center">PMs - '+$newRoom.data('username')+'</h3>\
						<span class="glyphicon glyphicon-repeat glyphicon-large glyphicon-spin"></span>\
						<div class="chat" style="display: none"></div>\
						<div class="input-group chat-input">\
							<textarea type="text" class="form-control text custom-control" placeholder="Enter message" style="resize:none"></textarea>\
							<span class="input-group-btn btn btn-default send input-group-addon" data-username="'+$newRoom.data('username')+'">send</span>\
						</div>\
					</div>\
				');
				slide($newRoom.data('username'), 'PM');
				socket.emit('getPMs', $newRoom.data('username'));
			}
			else
				slide($newRoom.data('username'), 'PM');
			socket.emit('seenMessages', 'to-'+$newRoom.data('username'));
			$newRoom.find('.badge').html(0);
			$newRoom.removeClass('notify');
			sortUsers();
		}
	});
}