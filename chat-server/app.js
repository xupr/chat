'use strict';

function joinRoom(roomid, socket, isCreator){
	isCreator = isCreator || false;
	client.sadd(roomid+':users', socket.username);
	client.sadd(socket.username+':rooms', roomid);
	var room = {roomid: roomid};
	var messages;
	client.sismemberAsync(roomid+':admins', socket.username).then(function(isAdmin){
		room.admin = (isAdmin === 1)? true : false;
		return client.getAsync(roomid+':name');
	}).then(function(roomName){
		room.roomName = roomName;
		return client.lrangeAsync(roomid+':messages',0,-1);
	}).then(function(m){
		messages = m;
		return client.smembersAsync(roomid+':users');
	}).then(function(users){
		socket.emit('usersInRoom', {roomid: roomid, users: users});
		socket.emit('joinedRoom', room);
		if(isCreator) socket.emit('createdRoom', {roomid: roomid, roomName: room.roomName});
		socket.emit('allMessages', {messages: messages, roomid: roomid});
		socket.join(roomid);
	}).catch(function(err){
		$('#console').append('<br>'+' '+err);
	});
}

var io = require('socket.io')(),
Promise = require('bluebird'),
mongoose = Promise.promisifyAll(require('mongoose')),
redis = Promise.promisifyAll(require('redis')),
client = redis.createClient(19237, 'pub-redis-19237.us-east-1-3.4.ec2.garantiadata.com'),
bcrypt = Promise.promisifyAll(require('bcryptjs')),
gui = require('nw.gui'),
win = gui.Window.get(),
uuid = require('node-uuid'),
_ = require('lodash'),
freeport = require('freeport');

var users = mongoose.createConnection('mongodb://server:server@ds031741.mongolab.com:31741/users');
var servers = mongoose.createConnection('mongodb://server:server@ds031627.mongolab.com:31627/servers');

var logged = [];
client.authAsync('chat').then(function(){
	var User = users.model('User', { username: String, password: String, logged: {type: Boolean, default: false} });

	freeport(function(err, port){
		if(err) console.log(err);
		else{
			var os = require('os'),
			http = require('http');

			var interfaces = os.networkInterfaces();
			var addresses = [];
			for (var k in interfaces) {
			    for (var k2 in interfaces[k]) {
			        var address = interfaces[k][k2];
			        if (address.family === 'IPv4' && !address.internal) {
			            addresses.push(address.address);
			        }
			    }
			}

			var server = http.createServer();
			server.listen(port, addresses[0]);
			
			io.listen(server);
			var Server = servers.model('Server', { connection: String, users: Number });
			var s = new Server({connection: 'http://'+addresses[0]+':'+port, users: 0});
			s.save(function(){
				win.on('close', function(){
					var win = this;
					win.hide();
					Server.findOne({connection: 'http://'+addresses[0]+':'+port}).remove().exec(function(){
						var loggedUsers = [];
						for (var i = logged.length - 1; i >= 0; i--) {
							if(logged[i].username) 
								loggedUsers.push(User.updateAsync({username: logged[i].username}, {logged: false})); 
						};

						if(loggedUsers.length === 0){
							client.quit();
							io.close();
							win.close(true);
						}
						Promise.all(loggedUsers).then(function(){
							client.quit();
							io.close();
							win.close(true);
						}).catch(function(err){
							$('#console').append('<br>'+' '+err);
						});
					});
				});
			});

			io.on('connection', function(socket){
				$('#console').append('<br>'+' client connected');
				Server.update({connection: 'http://'+addresses[0]+':'+port}, {$inc:{users:1}}).exec();
				socket.join('general');

				socket.on('message', function(message){
					if(socket.username){
						$('#console').append('<br>'+' '+message.text);
						client.lpush(message.roomid+':messages', JSON.stringify({username: socket.username, text: message.text, time: Date.now()}));
						io.to(message.roomid).emit('message', {username: socket.username, text: message.text, roomid: message.roomid, time: Date.now()});
						client.smembersAsync(message.roomid+':users').then(function(users){
							console.log(users);
							var time = Date.now();
							for (var i = users.length - 1; i >= 0; i--) {
								client.hincrby(users[i]+':newMessages', message.roomid, 1);
								client.hset(users[i]+':newMessages:time', message.roomid, time);
							};
						});
					}
				});

				socket.on('seenMessages', function(roomid){
					if(socket.username)
						client.hset(socket.username+':newMessages', roomid, -1);

				});

				socket.on('disconnect', function(){
					$('#console').append('<br>'+' client dced');
					Server.update({connection: 'http://'+addresses[0]+':'+port}, {$inc:{users:-1}}).exec();
					User.update({username: socket.username},{logged: false}).exec();
					socket.broadcast.to('logged').emit('logout', socket.username);
					logged.splice(logged.indexOf(socket), 1);
				});

				socket.on('register', function(data){
					$('#console').append('<br>'+' register: '+data.username+' '+data.password);
					User.findOneAsync({username: data.username}).then(function(exists){
						if(exists) $('#console').append('<br>'+' user exists');
						else 
							bcrypt.hashAsync(data.password, 10).then(function(hash){
								var user = new User({username: data.username, password: hash});
								return user.saveAsync();
							}).then(function(user){
								$('#console').append('<br>'+' successfuly added user');
								socket.broadcast.to('logged').emit('register', data.username);
								client.sadd('general:users', data.username);
							}).catch(function(err){
								$('#console').append('<br>'+' '+err);
							});
					}).catch(function(err){
						$('#console').append('<br>'+' '+err);
					});
				});

				socket.on('login', function(data){
					$('#console').append('<br>'+' login: '+data.username+' '+data.password);
					User.findOneAsync({username: data.username}).then(function(user){
						if(!user) {
							$('#console').append('<br>'+' user doesnt exists');
							socket.emit('logged', {status:'fail'});
						}
						else if(!user.logged)
							bcrypt.compare(data.password, user.password, function(err, res){
								if(err) {
									$('#console').append('<br>'+' '+err);
									socket.emit('logged', {status:'fail'});
								} else if(res) {
									$('#console').append('<br>'+' logged successfuly');
									User.update({username: data.username},{logged: true}).exec();
									socket.emit('logged', {status: 'success', username: data.username});
									client.existsAsync('general:messages').then(function(res){
										client.lrangeAsync('general:messages', 0, -1).then(function(res){
											socket.emit('allMessages', {roomid:'general', messages: res});
										}).catch(function(err){
											$('#console').append('<br>'+' '+err);
										});
										var newMessages;
										client.smembersAsync(data.username+':rooms').then(function(roomids){
											for (var i = roomids.length - 1; i >= 0; i--) {
												socket.join(roomids[i]);
											};
											Promise.map(roomids, function(val){
												return client.getAsync(val+':name').then(function(roomName){
													return {roomid: val, roomName: roomName};
												}).catch(function(err){
													$('#console').append('<br>'+' '+err);
												});
											}).then(function(rooms){
												socket.emit('joinedRooms', rooms);
												return User.find({username: {$ne: data.username}}, {username: 1, logged: 1, _id: 0}).sort({logged: 1, username: -1}).execAsync();
											}).then(function(users){
												socket.emit('users', users);
												socket.username = data.username;
												logged.push(socket);
												socket.broadcast.to('logged').emit('login', socket.username);
												socket.join('logged');
												return client.hgetallAsync(data.username+':newMessages');
											}).then(function(nm){
												if(nm){
													newMessages = nm;
													client.hgetallAsync(data.username+':newMessages:time').then(function(times){
														socket.emit('newMessages', {newMessages: newMessages, times: times});
													});
												}
											});
										});
									}).catch(function(err){
										$('#console').append('<br>'+' '+err);
									});
								} else {
									$('#console').append('<br>'+' wrong password');
									socket.emit('logged', {status:'fail'});
								}
							});
					}).catch(function(err){
						$('#console').append('<br>'+' '+err);
					});
				});

				socket.on('createRoom', function(roomName){
					var roomid = uuid.v4();
					client.set(roomid+':name', roomName);
					client.sadd(roomid+':admins', socket.username);
					joinRoom(roomid, socket, true);
				});

				socket.on('adminAction', function(req){
					client.sismemberAsync(req.roomid+':admins', socket.username).then(function(isAdmin){
						if(isAdmin){
							var found = false;
							for (var i = io.sockets.sockets.length - 1; i >= 0; i--) {
								if(io.sockets.sockets[i].username === req.username){
									if(req.action === 'addToRoom')
										joinRoom(req.roomid, io.sockets.sockets[i], false);
									else{
										io.sockets.sockets[i].leave(req.roomid);
										io.sockets.sockets[i].emit('banned', req.roomid);
										client.srem(req.roomid+':users', req.username);
										client.srem(req.username+':rooms', req.roomid);
									}
									found = true;
									break;
								}
							};

							if(!found){
								if(req.action === 'addToRoom'){
									client.sadd(req.roomid+':users', req.username);
									client.sadd(req.username+':rooms', req.roomid);
								}else{
									client.srem(req.roomid+':users', req.username);
									client.srem(req.username+':rooms', req.roomid);
								}
							}
							if(req.action === 'addToRoom')
								io.to(req.roomid).emit('userJoined', {roomid: req.roomid, username: req.username});
							else
								io.to(req.roomid).emit('userLeft', {roomid: req.roomid, username: req.username});
						}
					}).catch(function(err){
						$('#console').append('<br>'+' '+err);
					});
				});

				socket.on('joinRoom', function(roomid){
					joinRoom(roomid, socket, false);
				});

				socket.on('getPMs', function(username){
					if(username != socket.username){
						var usernames = [socket.username, username].sort();
						var privateChat = 'PMs:'+usernames[0]+'-'+usernames[1];
						client.lrangeAsync(privateChat, 0, -1).then(function(PMs){
							socket.emit('PMs', {username: username, PMs: PMs});
						});
					}
				});

				socket.on('PM', function(PM){
					if(PM.username != socket.username){
						var usernames = [socket.username, PM.username].sort();
						var privateChat = 'PMs:'+usernames[0]+'-'+usernames[1];
						client.lpush(privateChat, JSON.stringify({text: PM.text, username: socket.username, time: Date.now()}));
						socket.emit('PM', {text: PM.text, from: socket.username, to: PM.username, time: Date.now()});
						var to = _.find(logged, 'username', PM.username);
						if(to) to.emit('PM', {text: PM.text, from: socket.username, to: PM.username, time: Date.now()});
						client.hincrby(PM.username+':newMessages', 'to-'+socket.username, 1);
						client.hset(PM.username+':newMessages:time', 'to-'+socket.username, Date.now());
						client.hincrby(socket.username+':newMessages', 'to-'+PM.username, 1);
						client.hset(socket.username+':newMessages:time', 'to-'+PM.username, Date.now());
					}
				});
			});

			$('#console').append('server online');
		}
	});
}).catch(function(err){
	$('#console').append('<br>'+' '+err);
});