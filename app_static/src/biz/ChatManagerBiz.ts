import { ERole } from "../enum/ERole";
import MyService from "../api/UserService";
import rootStore from "../store";
import ErrorMsg from "../model/ErrorMsg";
import OrderService from "../api/OrderService";
import IUser from "../interface/model/IUser";
import { IOrder } from "../interface/model/IOrder";
import { getSocket } from "../socketLaunch";
import Vue from "vue";
import EChatMsgType from "../enum/EChatMsgType";
import { IOnlyChatRecord } from "../interface/mongomodel/IChatRecord";
import { EChatMsgStatus } from "../enum/EChatMsgStatus";
const socketWrapper = getSocket();
declare var wx:any;

/**
 * 聊天权限实体
 */
class ChatRole{
    private _current:ERole;
    set Current(value:ERole){
        this._current = value;
    }
    get Current(){
        return this._current;
    }

    private _to:ERole;
    set To(value:ERole){
        this._to = value;
    }
    get To(){
        return this._to;
    }
}

/**
 * socket聊天管理
 */
class ChatListener{
    public static readonly joinEvent = "join";
    public static readonly sendEvent = "send";
    public static readonly notifyEvent = "notify";
    public static readonly readEvent = "read";
    public static readonly leaveEvent = "leave";
    private static readonly MAX_COUNT = 3000;
    private static _VUE:Vue;

    private roomid:string;
    private uid:number;
    private touid:number;
    static send(obj:IOnlyChatRecord){
        if(obj.type===EChatMsgType.Audio){
            wx.downloadVoice({
                serverId: obj.serverId, // 需要下载的音频的服务器端ID，由uploadVoice接口获得
                isShowProgressTips: 1, // 默认为1，显示进度提示
                success: function (res:any) {
                    obj.localId = res.localId; // 返回音频的本地ID
                },
                fail:function(res:any){
                    console.log(res);
                }
            });
        }
        //NOTE:不能改成this
        ChatListener._VUE.$emit(ChatListener.sendEvent,obj);
        socketWrapper.emit(ChatListener.readEvent,{
            tokenid:obj.tokenid,
            roomid:obj.roomid
        });
    }

    static read(tokenid:string){
        ChatListener._VUE.$emit(ChatListener.readEvent,tokenid);
    }

    constructor(vue:Vue){
        ChatListener._VUE = vue;
    }

    /**
     * 加入房间
     * @param uid 
     * @param lid 
     * @param username 
     */
    join(uid:number,lid:number,username:string){
        this.uid = uid;
        this.touid = lid;
        return new Promise((resolve,reject)=>{
            const flag = setTimeout(function(){
                reject(new ErrorMsg(false,"socket无应答"));
            },ChatListener.MAX_COUNT);
            socketWrapper.emit(ChatListener.joinEvent,{
                pid:uid,lid:lid,name:username
            },(roomid:string)=>{
                clearTimeout(flag);
                this.roomid = roomid;
                resolve(roomid);
            });
        });
    }

    /**
     * 发送消息
     * @param chatMsgObj 
     */
    sendMsg(chatMsgObj:IOnlyChatRecord){
        chatMsgObj.status = EChatMsgStatus.Send;
        chatMsgObj.roomid = this.roomid;
        chatMsgObj.senduid = this.uid;
        chatMsgObj.touid = this.touid;
        if(chatMsgObj.localId){
            chatMsgObj.type = EChatMsgType.Audio;
        }else{
            chatMsgObj.type = EChatMsgType.Text;
        }
        return new Promise((resolve,reject)=>{
            const flag = setTimeout(function(){
                reject(new ErrorMsg(false,"socket无应答"));
            },ChatListener.MAX_COUNT);
            socketWrapper.emit(ChatListener.sendEvent,chatMsgObj,function(obj:any){
                chatMsgObj.tokenid = obj.tokenid;
                chatMsgObj.status = EChatMsgStatus.Send;
                clearTimeout(flag);
                resolve(chatMsgObj);
            });
        });
    }

    /**
     * 离开房间
     */
    leave(){
        socketWrapper.emit(ChatListener.leaveEvent,{
            roomid:this.roomid
        });
    }

    addEvent(){
        socketWrapper.on(ChatListener.readEvent,ChatListener.read);
        socketWrapper.on(ChatListener.sendEvent,ChatListener.send);
    } 
    
    removeEvent(){
        socketWrapper.remove(ChatListener.sendEvent,ChatListener.send);
        socketWrapper.remove(ChatListener.readEvent,ChatListener.read)
    }
}
export class ChatManagerBiz{
    private chatRole:ChatRole = new ChatRole();
    private userService:MyService;
    private orderService:OrderService;
    constructor(){
        this.userService = MyService.getInstance();
        this.orderService = OrderService.getInstance();
        this.chatRole.Current = <ERole>rootStore.state.user.role;
    }

    joinRoom(vue:Vue,uid:number,touid:number){
        const chatListener = new ChatListener(vue);
        //NOTE:暂时没有名字
        chatListener.join(uid,touid,"");
        return chatListener;
    }

    /**
     * 验证当前用户角色
     * @param lid 
     */
    public getData(lid:number) {
        return this.userService.getUser(lid).then(res=>{
            const data =res.data;
            if(data.success&&data.data){
                this.chatRole.To = <ERole>data.data.role;
                return Promise.resolve(res);
            }
            return Promise.reject(new ErrorMsg(false,"获取用户错误"));
        }).then<{roles:ChatRole,listener?:IUser,order?:IOrder}>(listenerRes=>{
            const currentUid = rootStore.state.user.id;
            return this.orderService.checkHasOrder(<number>currentUid,lid).then(res=>{
                const data =res.data;
                //都是倾听者  区分倾听者和倾诉者
                if(this.chatRole.Current===ERole.Listener&&this.chatRole.To===ERole.Listener){
                    this.checkRole(data.data);
                }
                return {
                    roles:this.chatRole,
                    listener:listenerRes.data.data,
                    order:data.data
                }
            });
        });
    }

    /**
     * 根据订单验证当前角色
     * @param lid 
     * @param order 
     */
    private checkRole(order?:IOrder){
        //存在订单 区分倾听者和倾诉者
        const currentUid = rootStore.state.user.id;
        if(order){
            if(currentUid===order.uid){
                this.chatRole.Current = ERole.Pourouter;
                this.chatRole.To = ERole.Listener;
            }else{
                this.chatRole.Current = ERole.Listener;
                this.chatRole.To = ERole.Pourouter;
            }
        }else{
            //不存在订单，都是倾诉者
            this.chatRole.Current = ERole.Pourouter;
            this.chatRole.To = ERole.Pourouter;
        }
    }
}