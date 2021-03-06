import { IEvaluate } from "../interface/model/IEvaluate";
import ErrorMsg from "../model/ErrorMsg";
import * as Bluebird from "bluebird";
import * as Sequelize from "sequelize";
import Evaluate from "../model/Evaluate";
import { EEvaluateStatus } from "../enum/EEvaluateStatus";
import CalucateService from "../helper/CalucateService";
import { IEvaluateModel } from "../model/viewmodel/IEvaluateModel";
import ObjectHelper from "../helper/objectHelper";
import sequelize from "../mysqlSeq";

export default class EvaluateService {

    /**
     * 好评界限
     */
    private static GOOD_PRAISE_FLOOR = 10;
    private static _instance: EvaluateService;

    private constructor() {
    }

    public create(model:IEvaluate){
        if(!model){
            return Bluebird.reject(new ErrorMsg(false,"参数不能为空"));
        }
        if(!model.uid){
            return Bluebird.reject(new ErrorMsg(false,"用户名不能为空"));
        }
        if(!model.uid){
            return Bluebird.reject(new ErrorMsg(false,"倾听者不能为空"));
        }
        if(!model.orderid){
            return Bluebird.reject(new ErrorMsg(false,"订单不能为空"));
        }
        return Evaluate.create(model);
    }

    /**
     * 
     * @param lid 倾听者id
     */
    public getList(lid:number){
        return Evaluate.findAll({
            where:{
                lid:lid,
                status:EEvaluateStatus.正常
            }
        });
    }

    public getAggregate(lid:number){
        const whereOp = {
            lid:lid,
            status:EEvaluateStatus.正常
        }
        const findPromise = Evaluate.find({
            attributes:[
                [Sequelize.fn("AVG",Sequelize.literal('`timerate`')),'timerate'],
                [Sequelize.fn("AVG",Sequelize.literal('`serviceattitude`')),'serviceattitude'],
                [Sequelize.fn("AVG",Sequelize.literal('`servicepower`')),'servicepower']
            ],
            where:whereOp
        });
        const totalPromise = sequelize.query(`
            SELECT ROUND(T1.count/T2.total*100,1) as goodrate
            FROM  
            (SELECT COUNT(id) AS count FROM \`evaluate\` WHERE \`timerate\`+\`serviceattitude\`+\`servicepower\`>${EvaluateService.GOOD_PRAISE_FLOOR}) AS T1,
            (SELECT COUNT(id) AS total FROM \`evaluate\`) AS T2
        `).spread((results) => {
            return results[0].goodrate;
        });
        const labelsPromise = Evaluate.findAll({
            where:whereOp,
            attributes:["labels"]
        }).then((res:any)=>{
            const labels = res as string[];
            const resultLabels:{text:string,count:number}[] = [];
            if(labels&&labels.length){
                labels.forEach(item=>{
                    const itemlabels:string[] = ObjectHelper.parseJSON(<string>item)||[];
                    itemlabels.forEach(element => {
                        const label = resultLabels.find(item=>item.text===element);
                        if(label){
                            label.count++;
                        }else{
                            resultLabels.push({text:element,count:1})
                        }
                    });
                });
            }
            return resultLabels;
        });
        return Promise.all([findPromise,totalPromise,labelsPromise]).then(res=>{
            const model:IEvaluateModel = {
                timerate:parseInt(res[0].timerate as string||"0"),
                serviceattitude:parseInt(res[0].serviceattitude as string||"0"),
                servicepower:parseInt(res[0].servicepower as string||"0"),
                applauserate:res[1]||1, 
                labels:res[2]
            };
            return model;
        });
    }

    public reply(eid:number,lid:number,replymessage:string){
        if(!replymessage){
            return Bluebird.reject(new ErrorMsg(false,"回复数据不能为空"));
        }
        if(replymessage.length>500){
            return Bluebird.reject(new ErrorMsg(false,"回复的消息太常"));
        }
        Evaluate.findOne({
            where:{
                id:eid,
                lid:lid,
            }
        }).then(evaluate=>{
            if(!evaluate){
                return Bluebird.reject(new ErrorMsg(false,'未找到对应数据'))
            }
            return Evaluate.update({
                replymessage:replymessage
            },{
                where:{
                    id:eid
                }
            });
        })
    }

    static createInstance() {
        EvaluateService.getInstance();
    }

    static getInstance() {
        return this._instance || (this._instance = new this());
    }

}