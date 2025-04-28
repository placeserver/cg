import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WsException} from '@nestjs/websockets';
import { Injectable, Inject, UseGuards, UseFilters, Req, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io'
import { parse } from 'cookie';
import { kurento } from 'kurento-client';
import * as wrtc from 'wrtc';
import moment from 'moment';
import { JwtAuthGuard } from '../authentication/strategies/jwt.auth.guard';
import { AuthService } from '../authentication/auth.service';
import { UserService } from '../user/user.service';
import { ConferenceService } from '../conference/conference.service';
import { ChattingService } from '../chatting/chatting.service';
import { VoteService } from '../vote/vote.service';
import { ConferenceDto } from '../conference/conference.dto';
import { WebsocketsExceptionFilter } from '../../../configure/filter/gateway.exception.filter';
import { CommonUtils } from '../../../configure/commons/common';
import { Roles } from '../authentication/roles.decorator'
import { SocketService } from './socket.service';

@UseFilters(WebsocketsExceptionFilter)
@WebSocketGateway({ namespace: 'socket', cors: true })
export class SocketGateway implements OnGatewayInit { 
	@WebSocketServer() server : Server;

	constructor(
		private readonly authService: AuthService,
		private readonly jwtService: JwtService,
		private readonly userService: UserService,
		private readonly chattingService: ChattingService,
		private readonly conferenceService: ConferenceService,
		private readonly voteService: VoteService,
		private readonly utils: CommonUtils,
		private readonly socketService: SocketService
	) {}

	private usersMap 		= {};
	private userSocketMap 	= {};
	private roomStatus 		= {};
	private clientRooms     = {};
	private timeoutInterval = {};

	/******** Conference Controlls : Start ********/

	
	/**
	 * 	setPointerMode
	 * @desc 소캣ID => ucode
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * 			pointer: 포인트 여부
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('setPointerMode')
	async setPointerMode(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode  	= socket?.user?.ucode;
		const confCode = data.confCode;
		const pointer  = data.pointer;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			const presenterCheck:any = await this.conferenceService.getConference(confCode);

			if(presenterCheck != null && presenterCheck?.permission_doc?.indexOf(ucode) > -1) {
				this.roomStatus[confCode].pointer = {check: pointer};
				this.brodcast(socket, 'setPointerMode', confCode, {pointer}, false);
			}
		}
	};

	/**
	 * documentMouseMark
	 * @desc 소캣ID => ucode
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * 			x: offset x
	 * 			y: offset y
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@SubscribeMessage('documentMouseMark')
	async documentMouseMark(@MessageBody() data: any, @ConnectedSocket() socket) {
		const smp_lang = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode = data.confCode;
		const x 		= data.x;
		const y 		= data.y;
		const h 		= data.h;
		const w 		= data.w;
		const click		= data.click;
		
		if(this.roomStatus[confCode].mousePosition == null) {
			this.roomStatus[confCode].mousePosition = {};
		}
		this.roomStatus[confCode].mousePosition['x'] = x;
		this.roomStatus[confCode].mousePosition['y'] = y;
		this.roomStatus[confCode].mousePosition['w'] = w;
		this.roomStatus[confCode].mousePosition['h'] = h;

		this.brodcast(socket, 'documentMouseMark', confCode, {x, y, w, h, click}, false);
	};

	/**
	 * moveViewMark
	 * @desc 소캣ID => ucode
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * 			vw: 뷰어 높이
	 * 			top: offset top
	 * }
	 * @params socket : 사용자 소캣
	 **/
	/*@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')*/
	@SubscribeMessage('moveViewMark')
	async moveViewMark(@MessageBody() data: any, @ConnectedSocket() socket) {
		//const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode = data.confCode;
		const vh 		= data.vh;
		const top 		= data.top;
		const st 		= data.st;
		const wh 		= data.wh;
		
		if(this.roomStatus[confCode].pointer == null) {
			this.roomStatus[confCode].pointer = {};
		}
		this.roomStatus[confCode].pointer['vh'] = vh;
		this.roomStatus[confCode].pointer['top'] = top;
		this.roomStatus[confCode].pointer['st'] = st;
		this.roomStatus[confCode].pointer['wh'] = wh;

		/*if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){*/
			this.brodcast(socket, 'moveViewMark', confCode, {vh, top, st, wh}, false);
		//}
	};

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('whiteboard.sync')
	handleWhiteboardSync(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
	const room = data.confCode;
	this.server.to(room).emit('whiteboard.sync', data); // 발표자 제외 참여자에게만 전송
	}


	/**
	 * getSocketIdByUcode
	 * @desc 소캣ID => ucode
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * 			ucode: 발표자를 요청 할 사용자 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('getSocketIdByUcode')
	async getSocketIdByUcode(@MessageBody() data: any, @ConnectedSocket() socket) {
		const cookie 	= parse(socket?.handshake?.headers?.cookie);
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (cookie?.smp_lang != 'kr' && cookie?.smp_lang != 'en' ? 'kr' : cookie?.smp_lang);
		const socketId = data.socketId;
		/*const confCode 	= data.confCode;
		const userUcode = data.userUcode;
		const type 		= data.type;
		const ucode  	= socket?.user?.ucode;*/

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			socket.emit("getSocketIdByUcode", {ucode:this.clientRooms[socketId].ucode, socketId:socketId});
		}
	};

	/**
	 * requestPresenter
	 * @desc 발표자 권한 요청
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * 			ucode: 발표자를 요청 할 사용자 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('requestPresenter')
	async requestPresenter(@MessageBody() data: any, @ConnectedSocket() socket) {
		const cookie 	= parse(socket?.handshake?.headers?.cookie);
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (cookie?.smp_lang != 'kr' && cookie?.smp_lang != 'en' ? 'kr' : cookie?.smp_lang);
		const confCode 	= data.confCode;
		const userUcode = data.userUcode;
		const type 		= data.type;
		const ucode  	= socket?.user?.ucode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			this.userSocketMap[confCode][userUcode].emit("requestPresenter", {name:this.usersMap[confCode][ucode].name, socketId:socket.id, userUcode:ucode, type});
		}
	};

	/**
	 * requestPresenterResult
	 * @desc 발표자 권한 요청 답변 전달
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * 			userUcode: 권한을 요청 한 사용자 코드
	 * 			value: 메세지
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('requestPresenterResult')
	async requestPresenterResult(@MessageBody() data: any, @ConnectedSocket() socket) {
		const cookie 	= parse(socket?.handshake?.headers?.cookie);
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (cookie?.smp_lang != 'kr' && cookie?.smp_lang != 'en' ? 'kr' : cookie?.smp_lang);
		const confCode 	= data.confCode;
		const userUcode = data.userUcode;
		const value 	= data.value;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			this.userSocketMap[confCode][userUcode].emit("requestPresenterResult", {value});
		}
	};

	/**
	 * changePresenter
	 * @desc 발표자 변경 알림
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('changePresenter')
	async changePresenter(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode = data.confCode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			this.brodcast(socket, 'changePresenter', confCode, {}, true);
			/*this.broadcast(confCode, null, client, 'changePresenter', null);
			client.emit("changePresenter", null);*/
		}
	};

	/**
	 * getStatus
	 * @desc 회의방 상태 Getter
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('getStatus')
	async getStatus(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang  = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode  = data.confCode;
		const type 		= data.type;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			let params = this.roomStatus[confCode] || {};
			params['type'] = type;

			socket.emit("getStatus", params);
		}
	};

	/**
	 * userSyncSetting
	 * @desc 회의방 상태 Getter (사용자 sync용)
	 * @params data : {
	 * 	confCode: 회의룸 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('userSyncSetting')
	async userSyncSetting(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang  = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode  = data.confCode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			let params = this.roomStatus[confCode] || {};
			
			socket.emit("userSyncSetting", params);
		}
	};

	/**
	 * setUserSyncSetting
	 * @desc 회의방 상태 Getter (사용자 sync용)
	 * @params data : {
	 * 	confCode: 회의룸 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('setUserSyncSetting')
	async setUserSyncSetting(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang  = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode  = data.confCode;
		const ucode 	= socket?.user?.ucode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			const confInfo = await this.conferenceService.getConference(confCode);
			if(confInfo.permission_doc?.indexOf(ucode) > -1) {
				this.brodcast(socket, 'setUserSyncSetting', confCode, {});
			}
		}
	};

	

	/**
	 * setStatus
	 * @desc 회의방 상태 Setter
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('setStatus')
	async setStatus(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang  = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode  = data.confCode;
		const type 		= data.type;

		const cookie 			= parse(socket?.handshake?.headers?.cookie);
		const authorization 	= cookie?.Authentication;
		const decodedToken: any = this.jwtService.decode(authorization);
		const ucode: string 	= decodedToken?.ucode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			const confInfo = await this.conferenceService.getConference(confCode);

			if(confInfo != null && confInfo.permission_doc.indexOf(ucode) > -1) {
				if(data?.mode?.sync != null) {
					this.roomStatus[confCode].sync = data.mode.sync;
				}

				if(data?.mode?.seminar != null) {
					this.roomStatus[confCode].seminar = data.mode.seminar;
				}

				if(data?.mode?.blackboard != null) {
					this.roomStatus[confCode].blackboard = data.mode.blackboard;
				}

				if(data?.mode?.screenShare != null) {
					this.roomStatus[confCode].screenShare = data.mode.screenShare;
				}

				if(data?.mode?.pdf != null) {
					this.roomStatus[confCode].pdf = data.mode.pdf;
				}
				if(data?.mode?.page != null) {
					this.roomStatus[confCode].page = data.mode.page;
				}
				if(data?.mode?.zoom != null) {
					this.roomStatus[confCode].zoom = data.mode.zoom;
				}
				
				this.brodcast(socket, 'setStatus', confCode, this.roomStatus[confCode], true);
			}
		}
	};

	/**
	 * getSyncData
	 * @desc 회의방 상태 Getter
	 * @params data : {
	 * 			confCode: 회의룸 코드
	 * }
	 * @params socket : 사용자 소캣
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('getSyncData')
	async getSyncData(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang  = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode  = data.confCode;
		const cookie 			= parse(socket?.handshake?.headers?.cookie);
		const authorization 	= cookie?.Authentication;
		const decodedToken: any = this.jwtService.decode(authorization);
		const ucode: string 	= decodedToken?.ucode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			const confInfo = await this.conferenceService.getConference(confCode);

			if(confInfo != null && confInfo.permission_doc.indexOf(ucode) == -1) {
				socket.emit('getSyncData', this.roomStatus[confCode]);
			}
		}
	};

	private async roleCheck(@MessageBody() data: any, @ConnectedSocket() socket){
		const cookie = socket?.handshake?.headers?.cookie;
		const ucode  = socket?.user?.ucode;
		const confCode = data.confCode;

		const { Authentication: authenticationToken, Refresh: refresh } = parse(cookie);
		const checked = await this.conferenceService.checkUserRole({ucode, ccode: confCode}, 'num');
		return (checked === 1 ? true : false);
	}
	/******** Conference Controlls : End ********/


	/******** User Controlls : Start ********/
	/**
	 * connection
	 * @desc 사용자 최초 접속 시 호출되는 함수
	 * @params socket : 사용자 소캣
	 **/
	async connection(@ConnectedSocket() socket) {
		socket.emit('connection', {});
		this.joinRoom(socket);
	}

	/**
	 * disconnection
	 * @desc 사용자가 연결이 끊기면 호출되는 함수
	 * @params socket : 사용자 소캣
	 **/
	async disconnection(@ConnectedSocket() socket) {
		this.leaveRoom(socket);
	}

	/**
	 * joinRoom
	 * @desc 룸별 통신을 위한 사용자 회의룸 입장
	 * @params socket : 사용자 소캣
	 **/
	async joinRoom(@ConnectedSocket() socket) {
		const {ccode, ucode} = await this.getQueryCode(socket);
		socket.join(ccode);

		const clientsInRoom = socket.adapter.rooms.get(ccode);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;
		const confInfo = await this.conferenceService.getConference(ccode);
		
		if(numClients == 1 && confInfo?.permission_doc?.indexOf(ucode) == -1 && confInfo?.participant?.indexOf(ucode) != -1) {
			const that = this;
			setTimeout(function(){
				let c = socket.adapter.rooms.get(ccode);
        		let n = clientsInRoom ? clientsInRoom.size : 0;
				
        		if(n == 1) {
					that.conferenceService.presenterDisconnetionChange({confCode : ccode, ucode:ucode});
					that.brodcast(socket, 'changePresenter', ccode, {type:null}, true);
        		}
			}, 5000);
		}
		this.clientRooms[socket.id] = {ucode, ccode};
		this.socketToRoom[socket.id] = ccode;
		if(ucode == null) return;
		await this.checkPresenterConnection(ccode, ucode);
		await this.setUserConnection(socket, ccode, ucode);
		this.sendAllUser(null, socket, ccode);

		if(this.roomStatus[ccode] == null) {
			this.roomStatus[ccode] = {
				sync: true,
				seminar: false,
				blackboard: false,
				screenShare: false,
				pdf: null,
				page: 1
			};
		}
	}

	/**
	 * leaveRoom
	 * @desc 사용자 회의룸 퇴장
	 * @params socket : 사용자 소캣
	 **/
	async leaveRoom(@ConnectedSocket() socket) {
		const {ccode, ucode} = await this.getQueryCode(socket);
		socket.leave(ccode);
		await this.setUserDisconnection(socket, ccode, ucode);
	}

	/**
	 * setUserConnection
	 * @desc 다른 사용자들에게 접속 알림
	 * @params socket : 사용자 소캣
	 * @params ccode : 회의룸 코드
	 * @params ucode : 사용자 코드
	 **/
	async setUserConnection(@ConnectedSocket() socket, ccode: string, ucode: string) {
		const userInfo = await this.getUserInfo(ucode);
		if(userInfo != null) {
			this.brodcast(socket, 'userConnection', ccode, {
				department: userInfo.department,
				position: userInfo.position,
				photo: userInfo.photo,
				role: userInfo.role,
				name: userInfo.name,
				ucode: userInfo.ucode
			}, true);

			if(this.usersMap[ccode] == null) {
				this.usersMap[ccode] = {}
			}

			if(this.userSocketMap[ccode] == null) {
				this.userSocketMap[ccode] = {};
			}

			this.usersMap[ccode][ucode] = userInfo;
			this.usersMap[ccode][ucode]['socket'] = socket.id;
			this.userSocketMap[ccode][ucode] = socket;
		}
	}

	/**
	 * setUserDisconnection
	 * @desc 다른 사용자들에게 접속해제를 알림
	 * @params socket : 사용자 소캣
	 * @params ccode : 회의룸 코드
	 * @params ucode : 사용자 코드
	 **/
	async setUserDisconnection(@ConnectedSocket() socket, ccode: string, ucode: string) {
		try{
			const userInfo = await this.getUserInfo(ucode);
			this.brodcast(socket, 'userDisconnection', ccode, {ucode: userInfo.ucode});
			delete this.usersMap[ccode][ucode];
			delete this.userSocketMap[ccode][ucode];
		}catch(e){}
	}

	/**
	 * sendAllUser
	 * @desc 현재 접속중인 모든 사용자
	 * @params socket : 사용자 소캣
	 * @params ccode : 회의룸 코드
	 * @params ucode : 사용자 코드
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('allUsers')
	async sendAllUser(@MessageBody() data: any, @ConnectedSocket() socket, ccode: string) {
		if(ccode == null) {
			ccode = data.ccode;
		}
		const users = this.usersMap[ccode];
		socket.emit('allUsers', users);
		this.brodcast(socket, 'allUsers', ccode, users);
	}

	/**
	 * conferenceUserExit
	 * @desc 사용자 강제 퇴장
	 * @params socket : 사용자 소캣
	 * @params smp_lang : 언어
	 * @params confCode : 회의룸 코드
	 * @params userUcode : 강제퇴장 시킬 사용자 코드
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('conferenceUserExit')
	async conferenceUserExit(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const confCode = data.confCode;
		const userUcode = data.userUcode;
		
		const cookie 			= parse(socket?.handshake?.headers?.cookie);
		const authorization 	= cookie?.Authentication;
		const decodedToken: any = this.jwtService.decode(authorization);
		const ucode: string 	= decodedToken?.ucode;
		const userInfo 			= await this.getUserInfo(ucode);
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			const confInfo = await this.conferenceService.getConference(confCode);

			if(confInfo.ucode == ucode || userInfo.role == 'admin') {
				this.userSocketMap[confCode][userUcode].emit("conferenceUserExit", {});
				/*const users = this.rooms[confCode];
				this.sendTo(users[userUcode].client.id, "conferenceUserExit", {})*/
			}else{
				throw new BadRequestException({"type":"error", "code":"1016"});	
			}
		}
	};

	/**
	 * setUserConnection
	 * @desc 다른 사용자들에게 접속 알림
	 * @params ucode : 사용자 코드
	 **/
	async getUserInfo(ucode: string) {
		return await this.userService.getUcodeByUser(ucode);
	}

	/**
	 * getQueryCode
	 * @desc 소켓 데이터에서 파라미터(ccode, ucode)추출
	 * @params ucode : 사용자 코드
	 **/
	
	async getQueryCode(@ConnectedSocket() socket) {
		// const cookieString = socket?.handshake?.headers?.cookie || '';
		// const cookie = cookieString ? parse(cookieString) : {};
		const cookie 			= parse(socket?.handshake?.headers?.cookie);
		const query 			= socket?.handshake?.query;
		const ccode 			= query?.ccode;
		const authorization 	= cookie?.Authentication;
		const decodedToken: any = this.jwtService.decode(authorization);
		const ucode: string 	= decodedToken?.ucode;

		return {ccode, ucode};
	}
	/******** User Controlls : End ********/


	/******** Chatting Controlls : Start ********/

	/**
	 * sendMessage
	 * @desc 채팅 메세지 전송
	 * @params socket : 사용자 소캣
	 * @params smp_lang : 언어
	 * @params confCode : 회의룸 코드
	 * @params message : 메세지
	 * @params users : 메세지 보낼 사용자 코드
	 * @params name : 보내는 사람 이름
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('sendMessage')
	async sendMessage(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			const ucode  	= socket?.user?.ucode;
			const userInfo 	= await this.userService.getUcodeByUser(ucode);
			const confCode 	= this.utils.removeStrExp(data?.confCode);
			const message 	= data.message;
			const users 	= data.users;
			const name 		= data.name;
			
			if(await this.endConferenceCheck(confCode) == true) {
				throw new BadRequestException({ "type": "error", "code": "1091", "lang": smp_lang });
			}

			if(this.utils.isEmpty(confCode) || this.utils.isEmpty(ucode) || this.utils.isEmpty(message)) {
				throw new BadRequestException({ "type": "error", "code": "1009", "lang": smp_lang });
			}

			let convertUsers = await this.userService.getUcodeByUsers(users, {id:1, email:1, ucode:1, name:1, role:1, _id:0});
			let resUsers = {};
			for(let i of convertUsers) {
				resUsers[i.ucode] = i;
			}

			const sendData = {
				ucode: ucode,
				name: userInfo.name,
				photo: userInfo.photo,
				message: data.message,
				users: resUsers
			};

			this.usersBrodcast(confCode, users, socket, "receiveMessage", sendData);
			const result = await this.chattingService.insertChatting(confCode, ucode, users, message, name);
		}
	};

	/**
	 * getChattingList
	 * @desc 채팅 리스트 불러오기
	 * @params socket : 사용자 소캣
	 * @params smp_lang : 언어
	 * @params confCode : 회의룸 코드
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('getChattingList')
	async getChattingList(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && data.smp_lang != 'en' ? 'kr' : data.smp_lang);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else if(roleCheck == true){
			const ucode  	= socket?.user?.ucode;
			const confCode 	= data.confCode;
			const result 	= await this.chattingService.getChatting(confCode);
			let userList 	= {};

			for(let i of result) {
				i.users = {}
				const receiver = [].concat(i.receiver);
				let diff = [];
				for(let j of receiver) {
					if(userList[j] != null) {
						i.users[j] = userList[j];
					}else{
						diff.push(j);
					}
				}

				if(userList[i.sender] == null) {
					diff.push(i.sender);
				}

				if(diff.length != 0) {
					let convertUsers = await this.userService.getUcodeByUsers(diff, {photo:1, id:1, email:1, ucode:1, name:1, role:1, _id:0});
					for(let c of convertUsers) {
						userList[c.ucode] = c;
						i.users[c.ucode] = c;
					}
				}
				
				i['photo'] = userList[i.sender]?.photo || '/assets/img/user.png';
				i['name'] = userList[i.sender]?.name
			}

			socket.emit("getChattingList", result);
		}
	};
	/******** Chatting Controlls : End ********/


	/******** Document Controlls : Start ********/

	/**
	 * changePdf
	 * @desc PDF 파일 변경
	 * @params socket : 사용자 소캣
	 * @params smp_lang : 언어
	 * @params confCode : 회의룸 코드
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('changePdf')
	async changePdf(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode 	= socket?.user?.ucode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode = this.utils.removeStrExp(data?.confCode);
			const confInfo = await this.conferenceService.getConference(confCode);

			if(confInfo.permission_doc?.indexOf(ucode) != -1) {
				const pdf = data?.pdf;
				if(this.roomStatus[confCode] == null) {
					this.roomStatus[confCode] = {}
				}

				this.roomStatus[confCode]['pdf'] = pdf;
				this.brodcast(socket, 'changePdf', confCode, {pdf});
			}
		}
	}

	/**
	 * sendPageChange
	 * @desc PDF 페이지 변경
	 * @params socket : 사용자 소캣
	 * @params smp_lang : 언어
	 * @params confCode : 회의룸 코드
	 * @params page : 페이지
	 * @params zoom : 줌
	 * @params t : 스크롤값
	 * @params vh : 화면 height값
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('sendPageChange')
	async sendPageChange(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const cookie = socket?.handshake?.headers?.cookie;
		const ucode  = socket?.user?.ucode;
		const clientId = socket?.id;
		const confCode = data.confCode;
		const page 			= data.page;
		const pdf 			= data.pdf;
		const zoom 			= data.zoom;
		const t 			= data.t;
		const vh 			= data.vh;
		const type 			= data.type;
		const { smp_lang } = parse(cookie);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang":smp_lang });
		}else if(roleCheck == true){
			const confInfo = await this.conferenceService.getConference(confCode);
			
			if(confInfo.ucode == ucode || confInfo.presenter?.indexOf(ucode) != -1) {
				let params = {page, pdf, zoom, t, vh, type};
				this.roomStatus[confCode]['page'] 	= page;
				this.roomStatus[confCode]['pdf'] 	= pdf;
				this.roomStatus[confCode]['zoom'] 	= zoom;
				this.roomStatus[confCode]['t'] 		= t;
				this.roomStatus[confCode]['vh'] 	= vh;
				if(type != 'notsend') {
					this.brodcast(socket, 'sendPageChange', confCode, params);
				}
			}
		}
	}

	/**
	 * changeScale
	 * @desc PDF scale 변경
	 * @params socket : 사용자 소캣
	 * @params smp_lang : 언어
	 * @params confCode : 회의룸 코드
	 * @params zoom : 줌
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('changeScale')
	async changeScale(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const cookie = socket?.handshake?.headers?.cookie;
		const ucode  = socket?.user?.ucode;
		const clientId = socket?.id;
		const confCode = data.confCode;
		const zoom 			= data.zoom;
		const { smp_lang } = parse(cookie);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang":smp_lang });
		}else if(roleCheck == true){
			const confInfo = await this.conferenceService.getConference(confCode);
			
			if(confInfo.ucode == ucode || confInfo.presenter?.indexOf(ucode) != -1) {
				this.roomStatus[confCode]['zoom'] = zoom;
				this.brodcast(socket, 'changeScale', confCode, {zoom});
			}
		}
	}

	/**
	 * updateDocumentList
	 * @desc PDF 파일 변경
	 * @params socket : 사용자 소캣
	 * @params confCode : 회의룸 코드
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('updateDocumentList')
	async updateDocumentList(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode 	= socket?.user?.ucode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode 	= this.utils.removeStrExp(data?.confCode);
			const type 		= this.utils.removeStrExp(data?.type);
			const filename 	= data?.filename;
			const confInfo = await this.conferenceService.getConference(confCode);

			//if(confInfo.permission_doc?.indexOf(ucode) != -1) {
				const pdf = data?.pdf;
				this.brodcast(socket, 'updateDocumentList', confCode, {type, filename});
			//}
		}
	}

	/**
	 * viewerScrollTop
	 * @desc 스크롤 이동
	 * @params socket : 사용자 소캣
	 * @params confCode : 회의룸 코드
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('viewerScrollTop')
	async viewerScrollTop(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode = this.utils.removeStrExp(data?.confCode);
			const t = data?.t;
			const h = data?.h;
			const x = data?.x;
			const w = data?.w;
			const top = data?.top;
			const left = data?.left;
			this.brodcast(socket, 'setViewerScroll', confCode, {t, h, x, w, top, left});
		}
	}

	/**
	 * requestFullscreen
	 * @desc 풀스크린 요청
	 * @params socket : 사용자 소캣
	 * @params confCode : 회의룸 코드
	 **/
	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('requestFullscreen')
	async requestFullscreen(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode = this.utils.removeStrExp(data?.confCode);
			const fullscreen = data?.fullscreen;
			this.brodcast(socket, 'requestFullscreen', confCode, {fullscreen});
		}
	}


	/******** Document Controlls : End ********/


	/******** Voice Controlls : Start ********/
	private receiverPCs  = {};
	private senderPCs 	 = {};
	private users 		 = {};
	private socketToRoom = {};
	private sturnConfig  = {
		
	}

	isIncluded = (array, id) => array.some((item) => item.id === id);
	async createReceiverPeerConnection(socketId, socket, roomID) {
		const pc = new wrtc.RTCPeerConnection(this.sturnConfig);
		if (this.receiverPCs[socketId]) {
			this.receiverPCs[socketId] = pc;
		}else{
			this.receiverPCs = { ...this.receiverPCs, [socketId]: pc };	
		} 
		pc.onicecandidate = (e) => {
			socket.emit("getSenderCandidate", {candidate: e.candidate});
		};
		pc.oniceconnectionstatechange = (e) => {};

		pc.ontrack = async (e) => {
			try{
				if (this.users[roomID]) {
					if (!this.isIncluded(this.users[roomID], socketId)) {
						this.users[roomID].push({
							id: socketId,
							stream: e.streams[0],
						});
					}
				} else {
					this.users[roomID] = [
						{
							id: socketId,
							stream: e.streams[0],
						}
					];
				}
			}catch(e){
				console.log(e);
			}

			this.brodcast(socket, 'userEnter', roomID, socketId);
		};
		return pc;
	}

	async createSenderPeerConnection (receiverSocketID, senderSocketID, socket, roomID) {
		const pc = new wrtc.RTCPeerConnection(this.sturnConfig);

  		if (this.senderPCs[senderSocketID]) {
    		this.senderPCs[senderSocketID].filter((user) => user.id !== receiverSocketID);
    		this.senderPCs[senderSocketID].push({ id: receiverSocketID, pc });
  		} else {
    		this.senderPCs = {
      			...this.senderPCs,
      			[senderSocketID]: [{ id: receiverSocketID, pc }]
    		};
    	}
		pc.onicecandidate = (e) => {
			socket.to(receiverSocketID).emit("getReceiverCandidate", {id: senderSocketID,candidate: e.candidate});
		};

		pc.oniceconnectionstatechange = (e) => {
		};

		const sendUser = this.users[roomID].filter((user) => user.id === senderSocketID)[0];

		sendUser.stream.getTracks().forEach((track) => {
			pc.addTrack(track, sendUser.stream);
		});

		return pc;
	}

	async getOtherUsersInRoom (socketId, roomID) {
		let allUsers = [];

		if (!this.users[roomID]) return allUsers;

		allUsers = this.users[roomID]
			.filter((user) => user.id !== socketId)
			.map((otherUser) => ({ id: otherUser.id }));

		return allUsers;
	}

	async deleteUser(socketId, roomID) {
		if (!this.users[roomID]) return;
		
		const sendUser:any = this.users[roomID].filter((user) => user.id === socketId)[0];

		if(sendUser != null && sendUser.stream != null) {
			sendUser.stream.getTracks().forEach((track) => {
				track.stop();
			});
		}

		this.users[roomID] = this.users[roomID].filter((user) => user.id !== socketId);
		
		if (this.users[roomID].length === 0) {
			delete this.users[roomID];
		}
		
		delete this.socketToRoom[socketId];
	}

	async closeReceiverPC(socketId) {
		if (!this.receiverPCs[socketId]) return;

		this.receiverPCs[socketId].close();
		delete this.receiverPCs[socketId];
	}

	async closeSenderPCs(socketId){
		if (!this.senderPCs[socketId]) return;

		this.senderPCs[socketId].forEach((senderPC) => {
			senderPC.pc.close();
			if(this.senderPCs[senderPC?.id] != null) {
				const eachSenderPC = this.senderPCs[senderPC.id].filter(
					(sPC) => sPC.id === socketId
				)[0];
				
				if (!eachSenderPC) return;
				eachSenderPC.pc.close();
				this.senderPCs[senderPC.id] = this.senderPCs[senderPC.id].filter(
					(sPC) => sPC.id !== socketId
				);
			}
		});
		delete this.senderPCs[socketId];
	}

	async wrtcDisconnect(@ConnectedSocket() socket) {
		try {
			let roomID = this.socketToRoom[socket.id];

			if(this.clientRooms[socket.id] == null) return;
			const { ccode, ucode } = this.clientRooms[socket.id];
			this.deleteUser(socket.id, roomID);
			this.closeReceiverPC(socket.id);
			this.closeSenderPCs(socket.id);
			delete this.socketToRoom[socket.id];
			this.brodcast(socket, 'userExit', ccode, { id: socket.id, ucode: ucode });
			this.checkPresenterDisconnection(ccode, ucode, socket);
		} catch (error) {
			console.log(error);
		}
	}

	/*@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('joinRoom')
	async socJoinRoom(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			let allUsers = this.getOtherUsersInRoom(data.id, data.roomID);
			const confCode  = data.confCode;		
			socket.emit('checkAllUser', { users: allUsers });
		} catch (error) {
			console.log(error);
		}
	}*/

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('senderOffer')
	async senderOffer(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			let pc = await this.createReceiverPeerConnection(
				data.senderSocketID,
				socket,
				data.roomID
			);
			await pc.setRemoteDescription(data.sdp);
			let sdp = await pc.createAnswer({offerToReceiveAudio: true, offerToReceiveVideo: false});
			await pc.setLocalDescription(sdp);
			
			let allUsers = await this.getOtherUsersInRoom(socket.id, data.roomID);	
			socket.emit('checkAllUser', { users: allUsers });

			socket.emit("getSenderAnswer", {sdp});
		} catch (error) {
			console.log(error);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('senderCandidate')
	async senderCandidate(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			let pc = this.receiverPCs[data.senderSocketID];
			await pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
    	} catch (error) {
			//console.log(error);
    	}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('receiverOffer')
	async receiverOffer(@MessageBody() data: any, @ConnectedSocket() socket) {

		try {
			let pc = await this.createSenderPeerConnection(
				data.receiverSocketID,
				data.senderSocketID,
				socket,
				data.roomID
			);
			await pc.setRemoteDescription(data.sdp);
			let sdp = await pc.createAnswer({
				offerToReceiveAudio: false,
				offerToReceiveVideo: false
			});
			await pc.setLocalDescription(sdp);
			socket.emit("getReceiverAnswer", { id: data.senderSocketID, sdp});
		} catch (error) {
			console.log(error);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('receiverCandidate')
	async receiverCandidate(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			const senderPC = this.senderPCs[data.senderSocketID].filter(
				(sPC) => sPC.id === data.receiverSocketID
			)[0];
			await senderPC.pc.addIceCandidate(
				new wrtc.RTCIceCandidate(data.candidate)
			);
		} catch (error) {
			//console.log(error);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('wrtcClose')
	async wrtcClose(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.closeReceiverPC(socket.id);
		this.closeSenderPCs(socket.id);
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('changeGainValue')
	async changeGainValue(@MessageBody() data: any, @ConnectedSocket() socket) {

		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;
		const gain 		= data.gain;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			this.brodcast(socket, 'changeGainValue', confCode, { gain: gain, ucode: ucode, socketId: socket.id });
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('getGainValue')
	async getGainValue(@MessageBody() data: any, @ConnectedSocket() socket) {

		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confInfo = await this.conferenceService.getConference(confCode);

			if(confInfo.conference_type == 0 && confInfo?.permission_doc?.indexOf(ucode) == -1)  {
				if(this.userSocketMap[confCode][confInfo?.permission_doc[0]] != null) {
					const sid = this.userSocketMap[confCode][confInfo?.permission_doc[0]].id;
					socket.to(sid).emit('getGainValue', {socketId:socket.id}); 
				}
			}
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('sendGainValue')
	async sendGainValue(@MessageBody() data: any, @ConnectedSocket() socket) {

		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;
		const gain 		= data.gain;
		const socketId	= data.socketId;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			socket.to(socketId).emit('changeGainValue', {gain, ucode, socketId}); 
		}
	}
	
	/******** Voice Controlls : End ********/


	/******** ScreenShare Controlls : Start ********/
	private shrReceiverPCs  = {};
	private shrSenderPCs 	= {};
	private shrUsers 		= {};
	private shrSocketToRoom = {};

	private shrCreateReceiverPeerConnection = (socketId, socket, roomID) => {
		const pc = new wrtc.RTCPeerConnection(this.sturnConfig);

		if (this.shrReceiverPCs[socketId]) {
			this.shrReceiverPCs[socketId] = pc;
		}else{
			this.shrReceiverPCs = { ...this.shrReceiverPCs, [socketId]: pc };	
		} 

		pc.onicecandidate = (e) => {
			socket.emit("shrGetSenderCandidate", {candidate: e.candidate});
		};

		pc.oniceconnectionstatechange = (e) => {
		//console.log(e);
		};

		pc.ontrack = (e) => {
			if (this.shrUsers[roomID]) {
				if (!this.isIncluded(this.shrUsers[roomID], socketId)) {
					this.shrUsers[roomID].push({
						id: socketId,
						stream: e.streams[0],
					});
				} else {
					return;
				}
			} else {
				this.shrUsers[roomID] = [
					{
						id: socketId,
						stream: e.streams[0],
					}
				];
			}
			this.brodcast(socket, 'shrUserEnter', roomID, socketId);
		};

		return pc;
	}

	private shrCreateSenderPeerConnection = (receiverSocketID, senderSocketID, socket, roomID) => {
		const pc = new wrtc.RTCPeerConnection(this.sturnConfig);

  		if (this.shrSenderPCs[senderSocketID]) {
    		this.shrSenderPCs[senderSocketID].filter((user) => user.id !== receiverSocketID);
    		this.shrSenderPCs[senderSocketID].push({ id: receiverSocketID, pc });
  		} else {
    		this.shrSenderPCs = {
      			...this.shrSenderPCs,
      			[senderSocketID]: [{ id: receiverSocketID, pc }]
    		};
    	}
		pc.onicecandidate = (e) => {
			socket.to(receiverSocketID).emit("shrGetReceiverCandidate", {id: senderSocketID,candidate: e.candidate});
		};

		pc.oniceconnectionstatechange = (e) => {
		};

		if(this.shrUsers[roomID] != null) {
			const sendUser = this.shrUsers[roomID].filter((user) => user.id === senderSocketID)[0];
			if(sendUser == null || sendUser.stream == null) return;
			sendUser.stream.getTracks().forEach((track) => {
				pc.addTrack(track, sendUser.stream);
			});

			return pc;
		}
	}

	private shrGetOtherUsersInRoom = (socketId, roomID) => {
		let allUsers = [];

		if (!this.shrUsers[roomID]) return allUsers;

		allUsers = this.shrUsers[roomID]
			.filter((user) => user.id !== socketId)
			.map((otherUser) => ({ id: otherUser.id }));

		return allUsers;
	}

	private shrDeleteUser = (socketId, roomID) => {
		if (!this.shrUsers[roomID]) return;

		const sendUser = this.shrUsers[roomID].filter((user) => user.id === socketId)[0];
		if(sendUser.stream != null) {
			sendUser.stream.getTracks().forEach((track) => {
				track.stop();
			});	
		}

		this.shrUsers[roomID] = this.shrUsers[roomID].filter((user) => user.id !== socketId);
		
		if (this.shrUsers[roomID].length === 0) {
			delete this.shrUsers[roomID];
		}
		
		delete this.shrSocketToRoom[socketId];
	}

	private shrCloseReceiverPC = (socketId) => {
		if (!this.shrReceiverPCs[socketId]) return;

		this.shrReceiverPCs[socketId].close();
		delete this.shrReceiverPCs[socketId];
	}

	private shrCloseSenderPCs = (socketId) => {
		if (!this.shrSenderPCs[socketId]) return;

		this.shrSenderPCs[socketId].forEach((senderPC) => {
			senderPC.pc.close();
			if(this.shrSenderPCs[senderPC?.id] != null) {
				const eachSenderPC = this.shrSenderPCs[senderPC.id].filter(
					(sPC) => sPC.id === socketId
				)[0];
				
				if (!eachSenderPC) return;
				
				eachSenderPC.pc.close();
				
				this.shrSenderPCs[senderPC.id] = this.shrSenderPCs[senderPC.id].filter(
					(sPC) => sPC.id !== socketId
				);
			}
		});

		delete this.shrSenderPCs[socketId];
	}

	/*@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('shrJoinRoom')
	async shrJoinRoom(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			let allUsers = this.shrGetOtherUsersInRoom(data.id, data.roomID);
			const confCode  = data.confCode;		
			socket.emit('shrAllUsers', { users: allUsers });
		} catch (error) {
			console.log(error);
		}
	}*/

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('shrSenderOffer')
	async shrSenderOffer(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			this.shrSocketToRoom[data.senderSocketID] = data.roomID;
			let pc = this.shrCreateReceiverPeerConnection(
				data.senderSocketID,
				socket,
				data.roomID
			);
			await pc.setRemoteDescription(data.sdp);
			let sdp = await pc.createAnswer({offerToReceiveAudio: false, offerToReceiveVideo: true});
			await pc.setLocalDescription(sdp);

			let allUsers = await this.getOtherUsersInRoom(socket.id, data.roomID);	
			socket.emit('shrCheckAllUser', { users: allUsers });

			//this.sendTo(data.senderSocketID, "shrGetSenderAnswer", {sdp})
			socket.emit("shrGetSenderAnswer", {sdp});
		} catch (error) {
			console.log(error);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('shrSenderCandidate')
	async shrSenderCandidate(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			let pc = this.shrReceiverPCs[data.senderSocketID];
			await pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
    	} catch (error) {
			
    	}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('shrReceiverOffer')
	async shrReceiverOffer(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			let pc = this.shrCreateSenderPeerConnection(
				data.receiverSocketID,
				data.senderSocketID,
				socket,
				data.roomID
			);
			await pc.setRemoteDescription(data.sdp);
			let sdp = await pc.createAnswer({
				offerToReceiveAudio: false,
				offerToReceiveVideo: false
			});
			await pc.setLocalDescription(sdp);
			socket.emit("shrGetReceiverAnswer", { id: data.senderSocketID, sdp});
			//this.sendTo(data.receiverSocketID, "shrGetReceiverAnswer", { id: data.senderSocketID, sdp});
		} catch (error) {
			console.log(error);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('shrReceiverCandidate')
	async shrReceiverCandidate(@MessageBody() data: any, @ConnectedSocket() socket) {
		try {
			const senderPC = this.shrSenderPCs[data.senderSocketID].filter(
				(sPC) => sPC.id === data.receiverSocketID
			)[0];
			await senderPC.pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
		} catch (error) {
			//console.log(error);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('shrCloseReceiver')
	async shrCloseReceiver(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.shrWrtcDisconnect(socket);
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('wrtcDisconnect')
	async closeReceiver(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.wrtcDisconnect(socket);
	}

	async shrWrtcDisconnect(@ConnectedSocket() socket) {
		try {
			let roomID = this.shrSocketToRoom[socket.id];
			const { ccode, ucode } = this.clientRooms[socket.id];
			this.shrDeleteUser(socket.id, roomID);
			this.shrCloseReceiverPC(socket.id);
			this.shrCloseSenderPCs(socket.id);
			delete this.shrSocketToRoom[socket.id];
			this.brodcast(socket, 'shrUserExit', ccode, { id: socket.id, ucode: ucode });
		} catch (error) {
			//console.log(error);
		}
	}
	/******** ScreenShare Controlls : End ********/


	/******** Whiteboard Controlls : Start ********/
	private whiteboardInfo = {};

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('userGetWhiteboardData')
	async userGetWhiteboardData(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode  = socket?.user?.ucode;
		const confCode = data.confCode;
		const drawBuffer = data.drawBuffer;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			this.brodcast(socket, 'userGetWhiteboardData', confCode, {});
		}
	}


	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('drawWithoutFetch')
	async drawWithoutFetch(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode  = socket?.user?.ucode;
		const confCode = data.confCode;
		const drawBuffer = data.drawBuffer;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			this.brodcast(socket, 'drawWithoutFetch', confCode, {});
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('setWhiteboardInfo')
	async setWhiteboardInfo(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode  = socket?.user?.ucode;
		const confCode = data.confCode;
		const drawBuffer = data.drawBuffer;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			if(this.whiteboardInfo[confCode] == null) this.whiteboardInfo[confCode] = {};
			if(this.whiteboardInfo[confCode][ucode] == null) this.whiteboardInfo[confCode][ucode] = {};
			this.whiteboardInfo[confCode][ucode] = drawBuffer;
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('drawToWhiteboard')
	async drawToWhiteboard(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode = this.utils.removeStrExp(data?.confCode);
			const content = data?.content;
			
			//this.broadcast(confCode, null, socket, 'drawToWhiteboard', content)
			this.brodcast(socket, 'drawToWhiteboard', confCode, content);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('getPresenterInfo')
	async getPresenterInfo(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode = this.utils.removeStrExp(data?.confCode);
			const confInfo = await this.conferenceService.getConference(confCode);

			this.brodcast(socket, 'getPresenterInfo', confCode, {}, true);
		}
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('setPresenterInfo')
	async setPresenterInfo(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang = (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		
		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode = this.utils.removeStrExp(data?.confCode);
			const confInfo = await this.conferenceService.getConference(confCode);

			this.brodcast(socket, 'setPresenterInfo', confCode, data);
		}
	}
	/******** Whiteboard Controlls : End ********/


	/******** New Voice Controlls : Start ********/
	async log(socket, msg1, msg2) {
        const array = ['Server:'];
        array.push(msg1);
        array.push(msg2);
        
        socket.emit('log', array);
    }

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('message')
	async message(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.log(socket, 'Client ' + socket.id + ' said: ', data.message);
		if (data.toId) {
            socket.to(data.toId).emit('message', data.message, socket.id);
        } else if (data.room) {
            socket.broadcast.to(data.room).emit('message', data.message, socket.id);
        } else {
            socket.broadcast.emit('message', data.message, socket.id);
        }
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('createOrJoin')
	async createOrJoin(@MessageBody() data: any, @ConnectedSocket() socket) {
		
		this.log(socket, 'Create or Join room: ', data.room);
        const clientsInRoom = socket.adapter.rooms.get(data.room);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;
        
        if (numClients === 0) {
            socket.join(data.room);
            socket.emit('created', data.room, socket.id);
        } else {
        	this.log(socket, 'Client ' + socket.id, ' joined room ' + data.room);

        	
            socket.in(data.room).emit('join', data.room); // Notify users in room
            socket.join(data.room);
            //socket.to(socket.id).emit('joined', data.room, socket.id); // Notify client that they joined a room
            socket.emit('joined', data.room, socket.id); // Notify client that they joined a room
            socket.in(data.room).emit('ready', socket.id); // Room is ready for creating connections
        }
    }

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('kickout')
	async kickout(@MessageBody() data: any, @ConnectedSocket() socket) {
        socket.broadcast.emit('kickout', socket.id);
        socket.leave(data.room);
    }

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('leaveRoom')
	async nwrLeaveRoom(@MessageBody() data: any, @ConnectedSocket() socket) {
        socket.leave(data.room);
        socket.emit('leftRoom', data.room);
        socket.broadcast.to(data.room).emit('message', { type: 'leave' }, socket.id);
    };


    /******** Live Streaming Controlls : Start ********/
	@SubscribeMessage('livestreamingStart')
	async livestreamingStart(@MessageBody() data: any, @ConnectedSocket() socket) {
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;
		const play 		= data.play;
		const videoName = data.videoName;
		const width 	= data.width;
		const height 	= data.height;

		//const presenterCheck:any = await this.conferenceService.getConference(confCode);
		
		//if(presenterCheck != null && presenterCheck?.permission_doc?.indexOf(ucode) > -1) {
			this.roomStatus[confCode].livestreaming = {default: {width, height}, videoName};
			this.brodcast(socket, 'livestreamingStart', confCode, {play, videoName});
		//}
    };

	@SubscribeMessage('livestreamingSetSize')
	async livestreamingSetSize(@MessageBody() data: any, @ConnectedSocket() socket) {
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;
		const size 		= data.size;

		//const presenterCheck:any = await this.conferenceService.getConference(confCode);
		
		//if(presenterCheck != null && presenterCheck?.permission_doc?.indexOf(ucode) > -1) {
			this.roomStatus[confCode].livestreaming['size'] = size;
			this.brodcast(socket, 'livestreamingSetSize', confCode, {size});
		//}
    };

	@SubscribeMessage('livestreamingSetGain')
	async livestreamingSetGain(@MessageBody() data: any, @ConnectedSocket() socket) {
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;
		const volume 	= data.volume;
		const muted 	= data.muted;
		const listenerSound 	= data.listenerSound;

		//const presenterCheck:any = await this.conferenceService.getConference(confCode);
		
		//if(presenterCheck != null && presenterCheck?.permission_doc?.indexOf(ucode) > -1) {
			this.roomStatus[confCode].livestreaming['volume'] = volume;
			this.roomStatus[confCode].livestreaming['muted'] = muted;
			this.brodcast(socket, 'livestreamingSetGain', confCode, {volume, muted, listenerSound});
		//}
    };

	@SubscribeMessage('livestreamingClose')
	async livestreamingClose(@MessageBody() data: any, @ConnectedSocket() socket) {
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;

		//const presenterCheck:any = await this.conferenceService.getConference(confCode);
		
		//if(presenterCheck != null && presenterCheck?.permission_doc?.indexOf(ucode) > -1) {
			this.roomStatus[confCode].livestreaming = null;
			this.brodcast(socket, 'livestreamingClose', confCode, {});
		//}
    };

	@SubscribeMessage('livestreamingGetInfo')
	async livestreamingGetInfo(@MessageBody() data: any, @ConnectedSocket() socket) {
		const ucode 	= socket?.user?.ucode;
		const confCode 	= data.confCode;
		const info 		= this.roomStatus[confCode].livestreaming;

		socket.emit('livestreamingGetInfo', {info});
		
    };

	@SubscribeMessage('updateMediaList')
	async updateMediaList(@MessageBody() data: any, @ConnectedSocket() socket) {
		const roleCheck = await this.roleCheck(data, socket);
		const smp_lang 	= (data.smp_lang != 'kr' && socket.smp_lang != 'en' ? 'kr' : data.smp_lang);
		const ucode 	= socket?.user?.ucode;

		if(roleCheck == false) {
			throw new BadRequestException({ "type": "error", "code": "1008", "lang": smp_lang });
		}else{
			const confCode 	= this.utils.removeStrExp(data?.confCode);
			const type 		= this.utils.removeStrExp(data?.type);
			const filename 	= data?.filename;

			this.brodcast(socket, 'updateMediaList', confCode, {});
		}
	}

    async liveStreamingDisconnection(@ConnectedSocket() socket) {
		const ucode 	= socket?.user?.ucode;
		const confCode  = this.clientRooms[socket.id]?.ccode;

		const presenterCheck:any = await this.conferenceService.getConference(confCode);
		
		if(presenterCheck != null && presenterCheck?.permission_doc?.indexOf(ucode) > -1) {
			this.roomStatus[confCode].livestreaming = null;
			this.brodcast(socket, 'livestreamingClose', confCode, {});
		}
    }

    @SubscribeMessage('sendLivestreamPlayPause')
	async sendLivestreamPlayPause(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.brodcast(socket, 'sendLivestreamPlayPause', data.confCode, {currentTime : data.currentTime, play: data.play, pause: data.pause, playTime: data.playTime});
	};

	@SubscribeMessage('sendLivestreamData')
	async sendLivestreamSendData(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.brodcast(socket, 'sendLivestreamData', data.confCode, {socketId : socket.id, gap: data.gap});
	};

	@SubscribeMessage('sendLivestreamData2')
	async sendLivestreamSendData2(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.brodcast(socket, 'sendLivestreamData2', data.confCode, {socketId : socket.id, currentTime : data.currentTime, playTime : data.playTime});
		// socket.emit('sendLivestreamData2', {socketId : socket.id, gap: data.gap, confCode : data.confCode});
	};

	@SubscribeMessage('sendLivestreamTargetData')
	async sendLivestreamTargetData(@MessageBody() data: any, @ConnectedSocket() socket) {
		const socketId = data.socketId;
		socket.to(socketId).emit("sendLivestreamTargetData", {currentTime: data.currentTime, muted: data.muted, paused: data.paused, playTime: data.playTime});
	};

    /******** Live Streaming Controlls : End ********/

    ///////////////////////////////////////////////////////////////////////

    @UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssMessage')
	async nssMessage(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.log(socket, 'Client ' + socket.id + ' said: ', data);
		if (data.toId) {
            socket.to(data.toId).emit('nssMessage', data.message, socket.id);
        } else if (data.room) {
            socket.broadcast.to(data.room).emit('nssMessage', data.message, socket.id);
        } else {
            socket.broadcast.emit('nssMessage', data.message, socket.id);
        }
	}

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssCreateOrJoin')
	async nssCreateOrJoin(@MessageBody() data: any, @ConnectedSocket() socket) {
		
		this.log(socket, 'Create or Join room: ', data.room);
        const clientsInRoom = socket.adapter.rooms.get(data.room);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;
        
        if (numClients === 0) {
            socket.join(data.room);
            socket.emit('nssCreated', data.room, socket.id);
        } else {
        	this.log(socket, 'Client ' + socket.id, ' joined room ' + data.room);

        	
            socket.in(data.room).emit('nssJoin', data.room); // Notify users in room
            socket.join(data.room);
            //socket.to(socket.id).emit('joined', data.room, socket.id); // Notify client that they joined a room
            socket.emit('nssJoined', data.room, socket.id); // Notify client that they joined a room
            socket.in(data.room).emit('nssReady', socket.id); // Room is ready for creating connections
        }
    }

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssKickout')
	async nssKickout(@MessageBody() data: any, @ConnectedSocket() socket) {
        socket.broadcast.emit('nssKickout', socket.id);
        socket.leave(data.room);
    }

	@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssLeaveRoom')
	async nssLeaveRoom(@MessageBody() data: any, @ConnectedSocket() socket) {
        socket.leave(data.room);
        socket.emit('nssLeftRoom', data.room);
        socket.broadcast.to(data.room).emit('nssMessage', { type: 'leave' }, socket.id);
    };

    /////////////////////////////////////////////////////////////////////////////////

    /*@UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssJoin')
	async nssJoin(@MessageBody() data: any, @ConnectedSocket() socket) {

    };*/
    private roomCallUser = {};

    @UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssJoin')
	async nssJoin(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log('nssJoin');
		const room = data.room;
		const type = data.type;


		socket.join(data.room);

		if(this.roomCallUser[room] == null) {
			this.roomCallUser[room] = {callee: [], caller: null};
		}

		if(type == 'callee') {
			this.roomCallUser[room]['callee'].push(socket.id);
		}else if(type == 'caller'){
			if(this.roomCallUser[room]['callee'].indexOf(socket.id) > -1) {
				this.roomCallUser[room]['callee'].splice(this.roomCallUser[room]['callee'].indexOf(socket.id), 1);
			}
			this.roomCallUser[room]['caller'] = socket.id;
		}

    };

    @UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssOffer')
	async nssOffer(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log('nssOffer : ', data);
		//io.sockets.emit('offer', offer);
		if(data.socketId != null) {
			//socket.in(data.room).emit('nssOffer', data.offer);
			socket.to(data.socketId).emit('nssOffer', data.offer);
		}else{
			socket.in(data.room).emit('nssOffer', data.offer);
		}
    };

    @UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssAnswer')
	async nssAnswer(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log('nssAnswer');
		//socket.in(data.room).emit('nssAnswer', data.answer);
		socket.to(this.roomCallUser[data.room]['caller']).emit('nssAnswer', {answer: data.answer});
    };

    @UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssCandidate')
	async nssCandidate(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log(data.type+" : ", 'nssCandidate');
		
		if (data.type == 'caller') {
			socket.broadcast.to(data.room).emit('nssCalleeCandidate', data.candidate);
            //io.to('callee').emit('candidate', candidate);
        } else if (data.type == 'callee') {
        	if(this.roomCallUser[data.room] != null) {
        		socket.to(this.roomCallUser[data.room]['caller']).emit('nssCallerCandidate', data.candidate);
        	}
        }
    };

    @UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssPeerConnection')
	async nssPeerConnection(@MessageBody() data: any, @ConnectedSocket() socket) {
		if(this.roomCallUser[data.room] != null) {
			socket.to(this.roomCallUser[data.room]['caller']).emit('nssPeerConnection', {socketId: socket.id});
		}
    };

    @UseGuards(JwtAuthGuard)
	@Roles('user', 'admin')
	@SubscribeMessage('nssEnded')
	async nssEnded(@MessageBody() data: any, @ConnectedSocket() socket) {
		if(this.roomCallUser[data.room] != null && this.roomCallUser[data.room]['caller'] == socket.id) {
			this.roomStatus[data.room].screenShare = false;
			socket.broadcast.to(data.room).emit('nssEnded', {});
		}
    };



    caller = [];
    callee = [];

    callerUser = null;
    calleeUser = null;

    @SubscribeMessage('join')
    async join(@MessageBody() data, @ConnectedSocket() socket) {

    	let room = data.room;

      if (room == 'caller') {
        socket.join(room);
        this.caller.push(socket.id);

        this.callerUser = socket.id;
      }
      else if (room == 'callee') {
        socket.join(room);
        this.callee.push(socket.id);

        this.calleeUser = socket.id;
      }
      else {
        throw new Error('Neither Caller and Callee');
      }
    }

    @SubscribeMessage('offer')
    async offer(@MessageBody() data, @ConnectedSocket() socket) {
    	let offer = data.offer;
      socket.broadcast.emit('offer', {offer: offer});
    }

    @SubscribeMessage('answer')
    async answer(@MessageBody() data, @ConnectedSocket() socket) {
    	let answer = data.answer
      socket.broadcast.emit('answer', {answer: answer});
    }

    @SubscribeMessage('candidate')
    async candidate(@MessageBody() data, @ConnectedSocket() socket) {
    	let candidate = data.candidate
      /*if (this.caller.includes(socket.id) == true) {
        socket.broadcast.to('callee').emit('calleeCandidate', {candidate: candidate});
      }
      else if (this.callee.includes(socket.id) == true) {
        socket.broadcast.to('caller').emit('callerCandidate', {candidate: candidate});
      }*/

      if (this.callerUser == socket.id) {
        socket.broadcast.to('callee').emit('calleeCandidate', {candidate: candidate});
      } else if (this.calleeUser == socket.id) {
        socket.broadcast.to('caller').emit('callerCandidate', {candidate: candidate});
      }
    }

    @SubscribeMessage('disconnect')
    async disconnect(@ConnectedSocket() socket) {
      //console.log('Socket Disconnected', socket.id);
    }











    /////////////////////////////////////////////////////////////////////////////////

	async nwrDisconnection(@ConnectedSocket() socket){
		let room = this.socketToRoom[socket.id];

		socket.leave(room);
	    this.nssEnded({room: room}, socket);
		socket.rooms.forEach((room) => {
	        if (room === socket.id) return;
	        socket.broadcast.to(room).emit('message', { type: 'leave' }, socket.id);
	    });
	}

    // participant leaves room
    /**/

    /**
     * When participant leaves notify other participants
     */
    /*socket.on('disconnecting', () => {
        socket.rooms.forEach((room) => {
            if (room === socket.id) return;
            socket.broadcast
                .to(room)
                .emit('message', { type: 'leave' }, socket.id);
        });
    });*/
	/******** New Voice Controlls : End ********/


	/******** Socket Init : Start ********/
	async afterInit(server: Server){
		this.socketService.socket = server;
		/*this.sturnConfig = await this.makeRequest();
		this.sturnConfig['iceServers'] = [this.sturnConfig['iceServers']];
		console.log(this.sturnConfig);*/
	}

	/*async makeRequest() {
	    return new Promise(function(resolve, reject) {
	    	var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
	        let xhr = new XMLHttpRequest();
	        xhr.onreadystatechange = function($evt) {
	            if (xhr.readyState == 4 && xhr.status == 200) {
	                let res = JSON.parse(xhr.responseText);
	                //console.log("response: ", res);
	                resolve(res.v);
	            }
	        }
	        xhr.open("PUT", "https://global.xirsys.net/_turn/sp", true);
	        xhr.setRequestHeader("Authorization", "Basic " + btoa("novuscorp:f862d9ea-7611-11ed-a902-0242ac130003"));
	        xhr.setRequestHeader("Content-Type", "application/json");
	        xhr.send(JSON.stringify({ "format": "urls" }));
	    });
	}*/

	brodcast(@ConnectedSocket() socket, event, ccode, data, self = false) {
		socket.broadcast.to(ccode).emit(event, data);
		if(self == true) {
			socket.emit(event, data);
		}
	}

	usersBrodcast(confCode: string, userCodes: string[], socket, event: string, message: any) {
		if(this.utils.isEmpty(confCode) == true || this.userSocketMap[confCode] == null) return;

		let userFilter = false;

		if(userCodes != null && Array.isArray(userCodes) && userCodes.length > 0) {
			userFilter = true;
		}

		if(userFilter == true) {
			for(let i of userCodes) {
				const other = this.userSocketMap[confCode][i];
				if(socket.id == other.id) continue;
				other.emit(event, message);
			}
		}else{
			for (let c in this.userSocketMap[confCode]) {
				const other = this.userSocketMap[confCode][c];
				if(socket.id == other.id) continue;

				other.emit(event, message);
			}
		}		
	}


	/**
	 * changeDisconnetionPresenter
	 * @desc 발표자가 나갔을 경우 가장 위에 존재하는 유저에게 발표권한 부여
	 * @params socket : 사용자 소캣
	 **/
	async changeDisconnetionPresenter(confCode, socket) {
		const cookie 	= parse(socket?.handshake?.headers?.cookie);
		const smp_lang 	= (cookie?.smp_lang != 'kr' && cookie?.smp_lang != 'en' ? 'kr' : cookie?.smp_lang);

		if(this.usersMap[confCode] != null && Object.keys(this.usersMap[confCode]).length > 0) {
			let presenterCheck = false;
			for(let i in this.usersMap[confCode]) {
				let check = await this.conferenceService.checkParticipant({confCode, ucode:i});
				// console.log('check', check);
				if(check == true) {
					presenterCheck = true;

					this.conferenceService.presenterDisconnetionChange({confCode, ucode:i});
					break;
				}
			}

			this.roomStatus[confCode].seminar 		= false;
			this.roomStatus[confCode].blackboard 	= false;
			this.roomStatus[confCode].screenShare 	= false;
			this.roomStatus[confCode].zoom 			= 'auto';

			this.brodcast(socket, 'changePresenter', confCode, {type:'disconnection'});
			
		}
	}

	async checkPresenterConnection(confCode, ucode) {
		if(this.timeoutInterval[confCode] != null && this.timeoutInterval[confCode][ucode] != null) {
			clearTimeout(this.timeoutInterval[confCode][ucode]);
			delete this.timeoutInterval[confCode][ucode];
		}
	}

	async endConferenceCheck(confCode) {
		const confInfo = await this.conferenceService.getConference(confCode);
		const end_date = confInfo.end_date;

		if(moment().valueOf() > end_date) {
			return true;
		}else{
			return false;
		}
	}

	/**
	 * checkPresenterDisconnection
	 * @desc 회의 방을 나갈 때 나간 사람이 발표자인지 체크하기
	 * @params socket : 사용자 소캣
	 **/
	async checkPresenterDisconnection(confCode, ucode, socket) {
		const presenterCheck:any = await this.conferenceService.getConference(confCode);
		const that = this;

		if(presenterCheck != null && presenterCheck?.permission_doc?.indexOf(ucode) > -1) {
			if(this.timeoutInterval[confCode] == null) this.timeoutInterval[confCode] = {};
			this.timeoutInterval[confCode][ucode] = setTimeout(function(){
				that.changeDisconnetionPresenter(confCode, socket);
			}, 8000);

			/*const adminUcode = presenterCheck.ucode;
			if(this.presenterChangeInterval[confCode] == null) this.presenterChangeInterval[confCode] = {};
			const that = this;

			if(this.roomStatus[confCode]?.sharing != null) {
				this.roomStatus[confCode].sharing = false;
			}

			this.presenterChangeInterval[confCode][ucode] = setTimeout(function(){
				if(that.rooms[confCode][adminUcode] != null) {
					that.conferenceService.setPresenterAuthAct(confCode, adminUcode);
				}else{
					for(let i in that.rooms[confCode]) {
						that.conferenceService.setPresenterAuthAct(confCode, i);
						break;
					}
				}

				that.broadcast(confCode, null, client, "updatePresenter", {});
				delete that.presenterChangeInterval[confCode][ucode];
			}, 5000);*/
		}
	}


	/******** Socket Init : End ********/

	@SubscribeMessage('getRoomPdf')
	async getPdf(@MessageBody() data: any, @ConnectedSocket() socket) {
		socket.emit('getRoomPdf', this.roomStatus[data.confCode].pdf);
	};

	@SubscribeMessage('test')
	async test(@MessageBody() data: any, @ConnectedSocket() socket) {
		this.brodcast(socket, 'test', data.confCode, {currentTime : data.currentTime, play: data.play, pause: data.pause});
	};

	@SubscribeMessage('test2')
	async test2(@MessageBody() data: any, @ConnectedSocket() socket) {
		console.log('test2');
		this.brodcast(socket, 'test2', data.confCode, {socketId : socket.id});
	};

	@SubscribeMessage('test3')
	async test3(@MessageBody() data: any, @ConnectedSocket() socket) {
		const socketId = data.socketId;
		socket.to(socketId).emit("test3", {currentTime: data.currentTime});
		//this.brodcast(socket, 'test2', data.confCode, {});
	};







	stIdCounter = 0;
	stCandidatesQueue = {};
	stKurentoClient = null;
	stPresenter = {};
	stViewers = [];
	stNoPresenterMessage = 'No active presenter. Try again later...';
	presenter = {};
	viewers = {};
	waitingViewers = {};
	sessionId = this.nextUniqueId();

	stOptions = {
		ws_uri: 'ws://localhost:3000/kurento'
	};

	handleConnection(@ConnectedSocket() socket){
		socket.sessionId = socket.handshake.query.ccode;
		socket.isMobile = socket.handshake.query.mobile;

		this.connection(socket);
	}

	handleDisconnect(socket){
		this.nwrDisconnection(socket);
		this.wrtcDisconnect(socket);
		this.disconnection(socket);

		this.sharingDisconnection(socket);
		this.liveStreamingDisconnection(socket);
	}

	sharingDisconnection(@ConnectedSocket() socket) {
		this.stop(socket.sessionId, socket);
		if (socket.isPresenter) {
			//console.log("unregister presenter " + socket.sessionId + " " + socket.id);
			delete this.presenter[socket.sessionId];
			Object.keys(this.viewers).forEach(id => {
				if (this.viewers[id].sessionId == socket.sessionId) {
					this.viewers[id].emit("presenterUnavailable");
				}
			});
			Object.keys(this.waitingViewers).forEach(id => {
				if (this.waitingViewers[id].sessionId == socket.sessionId) {
					this.waitingViewers[id].emit("presenterUnavailable");
				}
			});
			Object.keys(socket.viewers).forEach(id => {
				socket.viewers[id].emit("senderDisconnected");
			});
		}
		if (socket.isViewer) {
			this.unregisterViewer(socket);
		}
	}

	stop(sessionId, socket) {
		if (socket.isPresenter) {
			Object.keys(this.viewers).forEach(id => {
				if (this.viewers[id] && this.viewers[id].sessionId == socket.sessionId) {
					this.viewers[id].send(JSON.stringify({
						id: 'stopCommunication'
					}));
					if (this.viewers[id].webRtcEndpoint) {
						this.viewers[id].webRtcEndpoint.release();
						this.viewers[id].webRtcEndpoint = null;
					}
				}
			});
			if (this.stPresenter[socket.sessionId] && this.stPresenter[socket.sessionId].pipeline) {
				this.stPresenter[socket.sessionId].pipeline.release();
				this.stPresenter[socket.sessionId].pipeline = null;
			}
			delete this.stPresenter[socket.sessionId];
		}
		else if (this.viewers[socket.id]) {
			if (this.viewers[socket.id] && this.viewers[socket.id].webRtcEndpoint) {
				this.viewers[socket.id].webRtcEndpoint.release();
				this.viewers[socket.id].webRtcEndpoint = null;
			}
		}

		this.clearCandidatesQueue(sessionId);
	}

	getstKurentoClient(socket, callback) {
		if (this.stKurentoClient !== null) {
			return callback(null, this.stKurentoClient);
		}

		kurento(this.stOptions.ws_uri, function (error, _stKurentoClient) {
			if (error) {
				//console.log("Could not find media server at address " + this.stOptions.ws_uri);
				return callback("Could not find media server at address" + this.stOptions.ws_uri
					+ ". Exiting with error " + error);
			}
			//console.log("Open kurento clinet");
			this.stKurentoClient = _stKurentoClient;
			callback(null, this.stKurentoClient);
		});
	}


	clearCandidatesQueue(sessionId) {
		if (this.stCandidatesQueue[sessionId]) {
			delete this.stCandidatesQueue[sessionId];
		}
	}

	getSender = (sessionId, id) => {
		if (!this.presenter || !this.presenter[sessionId]) {
			return;
		}
		if (this.presenter[sessionId].streamMechanism == "peer") {
			return this.presenter[sessionId].id;
		}
		let viewerKeys = Object.keys(this.viewers);
		if (Object.keys(this.presenter[sessionId].viewers).length < 2) {
			return this.presenter[sessionId].id;
		}
		let senderId = null;
		for (let idx = 0; idx < viewerKeys.length; idx++) {
			let viewer = this.viewers[viewerKeys[idx]];
			if (!viewer) {
				continue;
			}
			if (viewer.sessionId != sessionId) {
				continue;
			}
			if (viewer.disconnected) {
				viewer.disconnect();
				continue;
			}
			if (viewer.isMobile == 'true') {
				continue;
			}
			if (Object.keys(viewer.viewers).length >= 2) {
				continue;
			}
			if (viewer.parents[id]) {
				continue;
			}
			if (viewer.senderId == this.viewers[id].senderId) {
				continue;
			}
			senderId = viewer.id;
			break;
		}
		if (!senderId) {
			senderId = this.presenter[sessionId].id;
		}
		return senderId;
	};



	unregisterViewer = (socket) => {
		Object.keys(socket.parents).forEach(parent => {
			if (this.viewers[parent]) {
				delete this.viewers[parent].childs[socket.id];
			}
		});
		if (this.presenter && this.presenter[socket.sessionId] && this.presenter[socket.sessionId].parents[socket.id]) {
			delete this.presenter[socket.sessionId].parents[socket.id];
		}

		Object.keys(socket.childs).forEach(child => {
			if (this.viewers[child]) {
				delete this.viewers[child].parents[socket.id];
			}
		});
		if (this.presenter && this.presenter[socket.sessionId] && this.presenter[socket.sessionId].childs[socket.id]) {
			delete this.presenter[socket.sessionId].childs[socket.id];
		}

		if (this.presenter && this.presenter[socket.sessionId]) {
			delete this.presenter[socket.sessionId].viewers[socket.id];
		}
		delete this.viewers[socket.id];

		if (socket.viewers) {
			Object.keys(socket.viewers).forEach(viewer => {
				try {
					if (!this.viewers[viewer]) {
						return;
					}
					this.viewers[viewer].senderId = this.getSender(this.viewers[viewer].sessionId, this.viewers[viewer].id);
					this.viewers[viewer].emit("senderDisconnected", { newSenderId: this.viewers[viewer].senderId });
					let sender = this.viewers[viewer].senderId != this.presenter[socket.sessionId].id ? this.viewers[this.viewers[viewer].senderId] : this.presenter[socket.sessionId];
					sender.viewers[viewer] = this.viewers[viewer];
					if (this.presenter && this.presenter[socket.sessionId]) {
						this.presenter[socket.sessionId].emit("viewerRegistered", { id: viewer, sender: this.viewers[viewer].senderId });
					}
				}
				catch (ex) { }
			});
		}
		if (this.viewers[socket.senderId]) {
			delete this.viewers[socket.senderId].viewers[socket.id];
			if (!this.viewers[socket.senderId].viewers) {
				this.viewers[socket.senderId].viewers = {};
			}
		}

		//console.log("unregister viewer " + socket.id);

		if (this.presenter && this.presenter[socket.sessionId]) {
			this.presenter[socket.sessionId].emit("viewerLeave", { id: socket.id });
		}
	}

	nextUniqueId() {
		this.stIdCounter++;
		return this.stIdCounter.toString();
	}

	startPresenter(sessionId, socket, sdpOffer, callback) {
		this.clearCandidatesQueue(sessionId);

		if (this.stPresenter[socket.sessionId] !== null && this.stPresenter[socket.sessionId] !== undefined) {
			this.stop(sessionId, socket);
			return callback("Another user is currently acting as this.stPresenter. Try again later ...");
		}

		this.stPresenter[socket.sessionId] = {
			id: sessionId,
			pipeline: null,
			webRtcEndpoint: null
		}
		socket.webRtcEndpoint = null;

		this.getstKurentoClient(socket, function (error, stKurentoClient) {
			if (error) {
				this.stop(sessionId, socket);
				return callback(error);
			}

			if (this.stPresenter[socket.sessionId] === null || this.stPresenter[socket.sessionId] === undefined) {
				this.stop(sessionId, socket);
				return callback(this.stNoPresenterMessage);
			}
			stKurentoClient.create('MediaPipeline', function (error, pipeline) {
				if (error) {
					this.stop(sessionId, socket);
					return callback(error);
				}

				if (!this.stPresenter[socket.sessionId]) {
					this.stop(sessionId, socket);
					return callback(this.stNoPresenterMessage);
				}

				this.stPresenter[socket.sessionId].pipeline = pipeline;

				socket.emit("streamserverPresenterAvailable");

				pipeline.create('WebRtcEndpoint', function (error, webRtcEndpoint) {
					if (error) {
						this.stop(sessionId, socket);
						return callback(error);
					}

					if (!this.stPresenter[socket.sessionId]) {
						this.stop(sessionId, socket);
						return callback(this.stNoPresenterMessage);
					}

					this.stPresenter[socket.sessionId].webRtcEndpoint = webRtcEndpoint;
					socket.webRtcEndpoint = webRtcEndpoint;

					if (this.stCandidatesQueue[sessionId]) {
						while (this.stCandidatesQueue[sessionId].length) {
							var candidate = this.stCandidatesQueue[sessionId].shift();
							webRtcEndpoint.addIceCandidate(candidate);
						}
					}

					webRtcEndpoint.on('OnIceCandidate', function (event) {
						var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
						socket.send(JSON.stringify({
							id: 'iceCandidate',
							candidate: candidate
						}));
					});

					webRtcEndpoint.processOffer(sdpOffer, function (error, sdpAnswer) {
						if (error) {
							this.stop(sessionId, socket);
							return callback(error);
						}

						if (!this.stPresenter[socket.sessionId]) {
							this.stop(sessionId, socket);
							return callback(this.stNoPresenterMessage);
						}

						callback(null, sdpAnswer);
					});

					webRtcEndpoint.gatherCandidates(function (error) {
						if (error) {
							this.stop(sessionId, socket);
							return callback(error);
						}
					});
				});
			});
		});
	}

	startViewer(sessionId, socket, sdpOffer, callback) {
		if (!this.stPresenter[socket.sessionId]) {
			this.stop(sessionId, socket);
			return callback(this.stNoPresenterMessage);
		}
		this.stPresenter[socket.sessionId].pipeline.create('WebRtcEndpoint', function (error, webRtcEndpoint) {
			if (error) {
				this.stop(sessionId, socket);
				return callback(error);
			}
			if (!this.viewers[socket.id]) {
				this.stop(sessionId, socket);
				return;
			}
			this.viewers[socket.id].webRtcEndpoint = webRtcEndpoint;
			/*stViewers[sessionId] = {
				"webRtcEndpoint" : webRtcEndpoint,
				"ws" : socket
			}*/

			if (!this.stPresenter[socket.sessionId]) {
				this.stop(sessionId, socket);
				return callback(this.stNoPresenterMessage);
			}

			if (this.stCandidatesQueue[sessionId]) {
				while (this.stCandidatesQueue[sessionId].length) {
					var candidate = this.stCandidatesQueue[sessionId].shift();
					webRtcEndpoint.addIceCandidate(candidate);
				}
			}

			webRtcEndpoint.on('OnIceCandidate', function (event) {
				var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
				socket.send(JSON.stringify({
					id: 'iceCandidate',
					candidate: candidate
				}));
			});

			webRtcEndpoint.processOffer(sdpOffer, function (error, sdpAnswer) {
				if (error) {
					this.stop(sessionId, socket);
					return callback(error);
				}
				if (!this.stPresenter[socket.sessionId]) {
					this.stop(sessionId, socket);
					return callback(this.stNoPresenterMessage);
				}

				this.stPresenter[socket.sessionId].webRtcEndpoint.connect(webRtcEndpoint, function (error) {
					if (error) {
						this.stop(sessionId, socket);
						return callback(error);
					}
					if (!this.stPresenter[socket.sessionId]) {
						this.stop(sessionId, socket);
						return callback(this.stNoPresenterMessage);
					}

					callback(null, sdpAnswer);
					webRtcEndpoint.gatherCandidates(function (error) {
						if (error) {
							this.stop(sessionId, socket);
							return callback(error);
						}
					});
				});
			});
		});
	}

	onIceCandidate(sessionId, _candidate, socket) {
		var candidate = kurento.getComplexType('IceCandidate')(_candidate);

		if (socket.isPresenter && socket.webRtcEndpoint) {
			socket.webRtcEndpoint.addIceCandidate(candidate);
		}
		else if (socket.isViewer && socket.webRtcEndpoint) {
			socket.webRtcEndpoint.addIceCandidate(candidate);
		}
		else {
			if (!this.stCandidatesQueue[sessionId]) {
				this.stCandidatesQueue[sessionId] = [];
			}
			this.stCandidatesQueue[sessionId].push(candidate);
		}
	}

	@SubscribeMessage('registerPresenter')
	async registerPresenter(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (this.presenter[socket.sessionId]) {
			/*if (typeof (fn) == 'function') {
				fn(false);
			}*/
			return socket.emit('registerPresenter', false);
		}
		//console.log("register presenter " + socket.sessionId + " " + socket.id);
		this.presenter[socket.sessionId] = socket;
		this.presenter[socket.sessionId].viewers = {};
		this.presenter[socket.sessionId].parents = {};
		this.presenter[socket.sessionId].childs = {};
		this.presenter[socket.sessionId].maxConnection = 2;
		this.presenter[socket.sessionId].streamMechanism = "distributed";
		socket.isPresenter = true;

		let existingViewers = [];
		Object.keys(this.viewers).forEach(id => {
			if (this.viewers[id].sessionId == socket.sessionId) {
				this.viewers[id].emit("presenterAvailable");
				existingViewers.push({ id: id });
			}
		});
		Object.keys(this.waitingViewers).forEach(id => {
			if (this.waitingViewers[id].sessionId == socket.sessionId) {
				this.waitingViewers[id].emit("presenterAvailable");
			}
		});
		//socket.emit("sendExistingViewers", existingViewers);		
		/*if (typeof (fn) == 'function') {
			fn(true);
		}*/
		return socket.emit('registerPresenter', true);
	}
	
	@SubscribeMessage('registerWaitingViewer')
	async registerWaitingViewer(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log("register waiting viewer " + socket.sessionId + " " + socket.id);
		if (this.viewers[socket.id]) {
			this.unregisterViewer(socket);
		}

		this.waitingViewers[socket.id] = socket;
		/*if (typeof (fn) == 'function') {
			fn({ presenterStatus: presenter && presenter[socket.sessionId] ? 'online' : 'offline', sharingStatus: presenter && presenter[socket.sessionId] ? presenter[socket.sessionId].sharingStatus : 'stop' });
		}*/
		return socket.emit('registerWaitingViewer', { presenterStatus: this.presenter && this.presenter[socket.sessionId] ? 'online' : 'offline', sharingStatus: this.presenter && this.presenter[socket.sessionId] ? this.presenter[socket.sessionId].sharingStatus : 'stop' });
	}

	@SubscribeMessage('registerViewer')
	async registerViewer(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log("register viewer " + socket.sessionId + " " + socket.id);
		delete this.waitingViewers[socket.id];
		this.viewers[socket.id] = socket;
		socket.isViewer = true;
		socket.viewers = {};
		socket.parents = {};
		socket.childs = {};
		if (!this.presenter || !this.presenter[socket.sessionId]) {
			socket.waitingPresenter = true;
			return;
		}
		socket.senderId = this.getSender(socket.sessionId, socket.id);

		let sender = this.viewers[socket.senderId] ? this.viewers[socket.senderId] : this.presenter[socket.sessionId];
		sender.viewers[socket.id] = socket;

		sender.childs[socket.id] = true;
		Object.keys(sender.parents).forEach(parent => {
			if (this.viewers[parent]) {
				this.viewers[parent].childs[socket.id] = true;
			}
		})
		socket.parents[sender.id] = true;

		if (this.presenter && this.presenter[socket.sessionId]) {
			this.presenter[socket.sessionId].emit("viewerRegistered", { id: socket.id, sender: socket.senderId });
		}
		/*if (typeof (fn) == 'function') {
			fn({ senderId: socket.senderId, sharingStatus: this.presenter[socket.sessionId].sharingStatus, streamMechanism: this.presenter && this.presenter[socket.sessionId] ? this.presenter[socket.sessionId].streamMechanism : null });
		}*/
		socket.emit('registerViewer', { senderId: socket.senderId, sharingStatus: this.presenter[socket.sessionId].sharingStatus, streamMechanism: this.presenter && this.presenter[socket.sessionId] ? this.presenter[socket.sessionId].streamMechanism : null });
	}

	@SubscribeMessage('setPresenterOffer')
	async setPresenterOffer(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (!this.viewers[data.id]) {
			return;
		}
		this.viewers[data.id].emit("sendPresenterOffer", { offer: data.offer });
	}

	@SubscribeMessage('setViewerOffer')
	async setViewerOffer(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (socket.senderId && this.viewers[socket.senderId]) {
			this.viewers[socket.senderId].emit("sendViewerOffer", { id: socket.id, offer: data.offer });
		}
		else {
			this.presenter && this.presenter[socket.sessionId] && this.presenter[socket.sessionId].emit("sendViewerOffer", { id: socket.id, offer: data.offer });
		}
	}

	@SubscribeMessage('setPresenterCandidate')
	async setPresenterCandidate(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (!this.viewers[data.id]) {
			return;
		}
		this.viewers[data.id].emit("sendPresenterCandidate", { candidate: data.candidate });
	}
	
	@SubscribeMessage('setViewerCandidate')
	async setViewerCandidate(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (!this.presenter || !this.presenter[socket.sessionId]) {
			return;
		}
		if (data.id) {
			if (this.viewers[data.id]) {
				this.viewers[data.id].emit("sendPresenterCandidate", { candidate: data.candidate });
			}
		}
		else {
			if (socket.senderId != this.presenter[socket.sessionId].id) {
				if (this.viewers[socket.senderId]) {
					this.viewers[socket.senderId].emit("sendViewerCandidate", { id: socket.id, candidate: data.candidate });
				}
			}
			else {
				this.presenter[socket.sessionId].emit("sendViewerCandidate", { id: socket.id, candidate: data.candidate });
			}
		}
	}

	@SubscribeMessage('senderCreatePeerConnection')
	async senderCreatePeerConnection(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (!this.viewers[data.sender]) {
			return;
		}
		this.viewers[data.sender].emit("senderCreatePeerConnection", { id: data.viewer });
	}

	@SubscribeMessage('presenterStopSharing')
	async presenterStopSharing(@MessageBody() data: any, @ConnectedSocket() socket) {
		
		if (!this.presenter[socket.sessionId]) {
			return;
		}
		//this.presenter[socket.sessionId].sharingStatus = "stop";
		delete this.presenter[socket.sessionId];

		Object.keys(this.viewers).forEach(id => {
			if (this.viewers[id].sessionId == socket.sessionId) {
				this.viewers[id].emit("sharingStopped");

				delete this.viewers[id];
			}
		});
		Object.keys(this.waitingViewers).forEach(id => {
			if (this.waitingViewers[id].sessionId == socket.sessionId) {
				this.waitingViewers[id].emit("sharingStopped");

				delete this.waitingViewers[id];
			}
		});
		this.stop(socket.sessionId, socket);
	}

	@SubscribeMessage('presenterStartSharing')
	async presenterStartSharing(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (this.presenter[socket.sessionId]) {
			this.presenter[socket.sessionId].sharingStatus = "start";
		}
		Object.keys(this.viewers).forEach(id => {
			if (this.viewers[id].sessionId == socket.sessionId) {
				this.viewers[id].emit("sharingStarted");
			}
		});
		Object.keys(this.waitingViewers).forEach(id => {
			if (this.waitingViewers[id].sessionId == socket.sessionId) {
				this.waitingViewers[id].emit("sharingStarted");
			}
		});
		for (let id in socket.viewers) {
			socket.viewers[id].emit("senderStartPlaying");
		}
	}

	@SubscribeMessage('setMechanism')
	async setMechanism(@MessageBody() data: any, @ConnectedSocket() socket) {
		if (!socket.isPresenter) {
			return;
		}
		socket.streamMechanism = data;
	}

	@SubscribeMessage('checkValidViewer')
	async checkValidViewer(@MessageBody() data: any, @ConnectedSocket() socket) {
		socket.emit("checkValidViewerResponse", { id: data, isValid: this.viewers[data] != null, sender: this.viewers[data] != null ? this.viewers[data].senderId : null });
	}
	
	@SubscribeMessage('error')
	async error(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log('Connection ' + this.sessionId + ' error');
		this.stop(this.sessionId, socket);
	}

	@SubscribeMessage('close')
	async close(@MessageBody() data: any, @ConnectedSocket() socket) {
		//console.log('Connection ' + this.sessionId + ' closed');
		this.stop(this.sessionId, socket);
	}

	@SubscribeMessage('clientServer')
	async clientServer(@MessageBody() data:any, @ConnectedSocket() socket : Socket){
		console.log('Received data:', data);
	}


	@SubscribeMessage('message2')
	async message2(@MessageBody() data: any, @ConnectedSocket() socket) {
		var message = JSON.parse(data);
		switch (message.id) {
			case 'presenter':
				this.startPresenter(this.sessionId, socket, message.sdpOffer, function (error, sdpAnswer) {
					if (error) {
						return socket.send(JSON.stringify({
							id: 'presenterResponse',
							response: 'rejected',
							message: error
						}));
					}
					socket.send(JSON.stringify({
						id: 'presenterResponse',
						response: 'accepted',
						sdpAnswer: sdpAnswer
					}));
				});
				break;

			case 'viewer':
				this.startViewer(this.sessionId, socket, message.sdpOffer, function (error, sdpAnswer) {
					if (error) {
						return socket.send(JSON.stringify({
							id: 'viewerResponse',
							response: 'rejected',
							message: error
						}));
					}

					socket.send(JSON.stringify({
						id: 'viewerResponse',
						response: 'accepted',
						sdpAnswer: sdpAnswer
					}));
				});
				break;

			case 'stop':
				this.stop(this.sessionId, socket);
				break;

			case 'onIceCandidate':
				this.onIceCandidate(this.sessionId, message.candidate, socket);
				break;

			default:
				socket.send(JSON.stringify({
					id: 'error',
					message: 'Invalid message ' + message
				}));
				break;
		}
	}
}