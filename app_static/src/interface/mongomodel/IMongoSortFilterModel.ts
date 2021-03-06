import { ESex } from "../../enum/ESex";
import { ERecieveStatus } from "../../enum/ERecieveStatus";
export interface IOnlyMongoSortFilterModel{
    uid?:number,
    //地区
    address?:number,
    //起步价
    generalprice?:number,
    //是否认证
    auth?:boolean,
    //好评率
    praisepercent?:number,
    //性别
    sex?:ESex,
    //家庭状态
    family?:number,
    //年龄
    birthday?:Date,
    //教育水平
    edu?:number,
    //已售时长
    sealtimes?:number,
    //可接单状态
    receivestatus?:ERecieveStatus,
    //标签ids
    labelids?:number[]
}
export default IOnlyMongoSortFilterModel;