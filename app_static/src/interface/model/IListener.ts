import { IUser } from "./IUser";
import { EAuthStatus } from "../../enum/EAuthStatus";
import { ERecieveStatus } from "../../enum/ERecieveStatus";
import { IListenLabel } from "./IMainLabel";

export interface IListener{
    id?:number,
    uid?:number,
    job?:number,
    family?:number,
    edu?:number,
    labelids?:string|any[],
    labeldesc?:string|any[],
    expids?:string|any[],
    expdesc?:string|any[],
    recievestatus?:ERecieveStatus,
    isopentime?:number,
    certificateurls?:string,
    authstatus?:EAuthStatus,
    minprice?:number,
    money?:number,
    labels?:IListenLabel[],//标签整合后的数据
    exps?:IListenLabel[],
    jobName?:string,
    user?:IUser,
    [index:string]:any
}
export default IListener;
