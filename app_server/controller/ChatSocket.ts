import IChatRecord, { IOnlyChatRecord } from "../interface/mongomodel/IChatRecord";
import { ERole } from "../enum/ERole";
import EChatMsgStatus from "../enum/EChatMsgStatus";
import EChatMsgType from "../enum/EChatMsgType";
import { retryInsertMongo } from "../helper/util";
import MongoChatRecord from "../model/mongo/MongoChatModel";
import SyncHelper from "../helper/syncHelper";
import _ = require("lodash");
import IChatModel from "../interface/IChatModel";
import * as uuid from "uuid";
const roomDic:{[index:string]:Array<IOnlyChatRecord>}={};
export class ChatSocket{
    private static readonly joinEvent = "join";
    private static readonly sendEvent = "send";
    private static readonly notifyEvent = "notify";
    private static readonly readEvent = "read";
    private static readonly MAX_MSG_LENGTH = 100;
    private static readonly RETRY_COUNT = 5;
    private syncHelper: SyncHelper;
    constructor(private socket:SocketIO.Socket,private role:ERole){
        this.syncHelper = SyncHelper.getInstance();
        this.initEvent();
    }

    public static createRoom(source:number,target:number){
        return source+"_"+target;
    }

    private initEvent(){
        this.socket.on(ChatSocket.joinEvent,this.joinRoom.bind(this));
        this.socket.on(ChatSocket.sendEvent,this.sendMsg.bind(this));
        this.socket.on(ChatSocket.readEvent,this.read.bind(this)); 
        this.socket.on('disconnect',this.disconnectInsetAll.bind(this));
        this.socket.on("leave",this.leaveInsertRoomRecords.bind(this));
        this.socket.on("error",()=>{
            for(let key in roomDic){
                delete roomDic[key];
            }
        });       
    }

    /**
     * 加入房间事件
     * @param data 
     */
    private joinRoom(data:{pid:number,lid:number,name:string},ackFn:(...args:any[])=>void){
        const pid = data.pid;//倾诉者
        const lid = data.lid;//倾听者
        const roomid = ChatSocket.createRoom(pid,lid);
        
        this.socket.join(roomid);
        this.socket.to(roomid).emit(ChatSocket.joinEvent,{msg:`${data.name}加入房间`,roomid}); 
        ackFn(roomid);  
    }

    /**
     * 发送消息事件
     * @param res 
     */
    private sendMsg(res:IChatModel,ackFn:(...args:any[])=>void){
        let tempsenduid = res.pid;
        let temptouid = res.lid;
        if(!tempsenduid||!temptouid){
            return;
        }
        if(this.role===ERole.Listener){
            tempsenduid = res.lid;
            temptouid = res.pid;
        }
        const roomid = ChatSocket.createRoom(res.pid,res.lid);
        const msgObj:IOnlyChatRecord = {
            tokenid:uuid(),
            roomid,
            senduid:tempsenduid,
            touid:temptouid,
            date:new Date(),
            status:EChatMsgStatus.Send,
            type:EChatMsgType.Text,
            msg:res.msg
        }
        if(res.type===EChatMsgType.Audio){
            msgObj.isload=false;
            msgObj.mediaid = res.mediaid;
            msgObj.type = EChatMsgType.Audio
        }
        if (!roomDic[roomid]) {
            roomDic[roomid] = [];
        }
        roomDic[roomid].push(msgObj);
        //当消息长度大于最大限制时，插入库中并删除
        if(roomDic[roomid].length>=ChatSocket.MAX_MSG_LENGTH){
            setTimeout(()=>{
                const shouldInsertedRecord = roomDic[roomid].splice(0,ChatSocket.MAX_MSG_LENGTH);
                retryInsertMongo(ChatSocket.RETRY_COUNT)
                (MongoChatRecord,<IChatRecord[]>shouldInsertedRecord,(err,docs)=>{
                    this.syncAudio(docs);
                });
            });
        }
        this.socket.to(roomid).broadcast.emit(ChatSocket.sendEvent,msgObj);
        //去指定的用户通知
        this.socket.to(temptouid.toString()).broadcast.emit(ChatSocket.notifyEvent,msgObj);
        ackFn(msgObj);
    }

    private read(data:{tokenid:string,roomid:string}){
        const roomid = data.roomid;
        if(roomDic[roomid]&&roomDic[roomid].length){
            const chatList = roomDic[roomid];
            const current = chatList.find(item=>item.tokenid===data.tokenid);
            if(current){
                this.socket.to(roomid).broadcast.emit(ChatSocket.readEvent,current.tokenid);
                MongoChatRecord.update({
                    tokenid:current.tokenid
                },{
                    status:EChatMsgStatus.Readed
                });
            }
        }
    }

    /**
     * 端口链接事件
     */
    private disconnectInsetAll(){
        const rooms = _.values(this.socket.rooms);
        let records:IOnlyChatRecord[] = [];
        rooms.forEach(item=>{
            records = records.concat(roomDic[item]||[]);
        })
        // const values = _.values(roomDic);
        // const records = _.flatten(values);
        if(records.length){
            retryInsertMongo(ChatSocket.RETRY_COUNT)(MongoChatRecord,<IChatRecord[]>records,(err,docs)=>{
                for(let key in roomDic){
                    delete roomDic[key];
                }
                this.syncAudio(docs);
            });
        }
    }

    /**
     * 离开房间事件
     * @param data 
     */
    private leaveInsertRoomRecords(data:{roomid:string}){
        const roomid = data.roomid;
            if(roomid){
                this.socket.leave(roomid);
                if(roomDic[roomid]&&roomDic[roomid].length){
                    retryInsertMongo(ChatSocket.RETRY_COUNT)(MongoChatRecord,<IChatRecord[]>roomDic[roomid],(err,docs)=>{
                        delete roomDic[roomid];
                        this.syncAudio(docs);
                    });
                }
            }
    }

    /**
     * 同步音频
     * @param docs 
     */
    private syncAudio(docs:IChatRecord[]){
        const ids = docs.filter(item=>item.type===EChatMsgType.Audio).map(item=>item._id);
        if(ids.length){
            this.syncHelper.syncAudio(ids);
        }
    }

    static getInstance(socket:SocketIO.Socket,role:ERole){
        return new ChatSocket(socket,role);
    }
}

export default ChatSocket;