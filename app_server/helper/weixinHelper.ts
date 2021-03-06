import * as express from 'express';
import * as request from 'request';
const crypto = require('crypto');
import * as xml2js from "xml2js";
import {stringify} from "querystring";
import { IWeixinModel } from '../interface/IWeixinModel';
import ErrorMsg from '../model/ErrorMsg';
import ObjectHelper from './objectHelper';
import { createNonceStr } from './util';
import { getCacheData } from './cacheHelper';
const wxconfig = require("../../config/wxconfig.json");
const appid = wxconfig.appid;
const appsecret = wxconfig.appsecret;
interface IAccessTokenModel{
    access_token:string,
    openid:string,
    expires_in:number,
    refresh_token:string,
    scope:string
}

export default class WeixinHelper{
    static getAccesstoken(code:string){
        if(!code){
            return Promise.reject({message:"code不能为空"});
        }
        return new Promise<IAccessTokenModel>((resolve,reject)=>{
            request(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${appsecret}&code=${code}&grant_type=authorization_code`,
            function(err,response){
                if(err){
                    reject(err);
                    return;
                }
                if(response.statusCode != 200){
                    reject({success:false,message:"返回状态:"+response.statusCode});
                    return;
                }
                let body = response.body;
                let isError = false;
                try{
                    body = JSON.parse(response.body);
                }catch(e){
                    isError = true;
                }
                if(isError){
                    reject({success:false,message:"解析出错"});
                    return;
                }
                
                resolve(<IAccessTokenModel>body);
            });
        });
    }

    /**
     * 基础接口的token 
     */
    static getBaseAccessToken(){
        return <Promise<IAccessTokenModel>>getCacheData("GET_TOKE_CACHE",()=>{
            return new Promise<IAccessTokenModel>((resolve,reject)=>{
                request(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${appsecret}`,
                function(err,response){
                    if(err){
                        reject(err);
                        return;
                    }
                    if(response.statusCode != 200){
                        reject({success:false,message:"返回状态:"+response.statusCode});
                        return;
                    }
                    let body = response.body;
                    let isError = false;
                    try{
                        body = JSON.parse(response.body);
                    }catch(e){
                        isError = true;
                    }
                    if(isError){
                        reject({success:false,message:"解析出错"});
                        return;
                    }
                    if(body.access_token){
                        resolve(<IAccessTokenModel>body);
                    }else{
                        reject(new ErrorMsg(false,body.errmsg));
                    }
                });
            });
        },{
            stdTTL: 2*60*60
        })
 
    }
    static getUserinfoByCode(code:string){
        return this.getAccesstoken(code).then(res=>this.getUserinfo(res.access_token,res.openid));
    }

    static getUserinfo(accesstoken:string,openid:string){
        if(!accesstoken){
            return Promise.reject({message:"accesstoken不能为空"});
        }
        if(!openid){
            return Promise.reject({message:"openid不能为空"})
        }
        return new Promise<IWeixinModel>((resolve,reject)=>{
            request(`https://api.weixin.qq.com/sns/userinfo?access_token=${accesstoken}&openid=${openid}&lang=zh_CN`,
            function(err,response){
                if(err){
                    reject(err);
                    return;
                }
                if(response.statusCode != 200){
                    reject({success:false,message:"返回状态:"+response.statusCode});
                    return;
                }
                let body = response.body;
                let isError = false;
                try{
                    body = JSON.parse(response.body);
                }catch(e){
                    isError = true;
                }
                if(isError){
                    reject({success:false,message:"解析出错"});
                    return;
                }
                const userModel = <IWeixinModel>body;
                userModel.accesstoken = accesstoken;
                resolve(<IWeixinModel>body);
            });
        });
    }

    /**
     * 支付成功回调
     */
    static recieve(req:express.Request){
        /**
         * 
            <xml><appid><![CDATA[wxe6c6ab2ef372xxxx]]></appid>
            <attach><![CDATA[2&85&139&0]]></attach>
            <bank_type><![CDATA[CFT]]></bank_type>
            <cash_fee><![CDATA[1]]></cash_fee>
            <fee_type><![CDATA[CNY]]></fee_type>
            <is_subscribe><![CDATA[Y]]></is_subscribe>
            <mch_id><![CDATA[129933xxxx]]></mch_id>
            <nonce_str><![CDATA[6xj94ajjika3io01f50z2cf9658fhhtj]]></nonce_str>
            <openid><![CDATA[ojN41uHLEXYuHkrJg2_PaDvxxxxx]]></openid>
            <out_trade_no><![CDATA[129933950120170618102333]]></out_trade_no>
            <result_code><![CDATA[SUCCESS]]></result_code>
            <return_code><![CDATA[SUCCESS]]></return_code>
            <sign><![CDATA[5060B8EE326BD346B7808D9996594A79]]></sign>
            <time_end><![CDATA[20170618102338]]></time_end>
            <total_fee>1</total_fee>
            <trade_type><![CDATA[JSAPI]]></trade_type>
            <transaction_id><![CDATA[4001862001201706186249259476]]></transaction_id>
            </xml>
         */

        const body = req.body;
        if(!body){
            return Promise.reject(new ErrorMsg(false,"参数为空"));
        }
        xml2js.parseString(body,(err,data)=>{
            if(err){
               return Promise.reject(err);
            }
            if(!data||!data.xml){
                return Promise.reject(new ErrorMsg(false,"微信返回数据为空"))
            }
            const root = data.xml;
            if(!root.result_code&&!root.result_code.length){
                return Promise.reject(new ErrorMsg(false,"支付失败，未返回result_code"));
            }
            if(root.result_code[0]==='SUCCESS'){
                if(!this.checkSign(root)){
                    return Promise.reject(new ErrorMsg(false,"支付失败，返回签名失败"));
                }
                return Promise.resolve(new ErrorMsg(true,"支付成功"));
            }
            return Promise.reject(new ErrorMsg(false,"支付失败，返回签名失败"));
        });
    }

    /**
     * 验证微信返回的签名
     * @param map 
     */
    private static checkSign(map:any){
        const sign = map.sign[0];
        if(!sign){
            return new ErrorMsg(false,"签名为空");
        }
        const dic:any = {};
        for(let key in map){
            if(key!=='sign'&&map[key]&&map[key][0]&&map[key][0]!==""){
                dic[key] = map[key][0];
            }
        }
        const str = stringify(dic);
        const hash = crypto.createHash('md5').update(str,'utf8').digest('hex');
        return sign===hash;
    }

    public static getJsTicket(access_token:string){
        // https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token={$access_token}&type=jsapi
        if(!access_token){
            return Promise.reject(new ErrorMsg(false,"access_token为空"));
        }
        return new Promise<string>(function(resolve,reject){
            request(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`,(err,res)=>{
                if(err){
                    reject(err);
                }
                if(res.statusCode!=200){
                    reject(res);
                }
                resolve(res.body);
            });
        });
    }

    public static getJsConfig(url:string):Promise<any>{
        if(!url){
            return Promise.reject(new ErrorMsg(false,"url为空"));
        }
        return this.getBaseAccessToken().then(res=>{
            return this.getJsTicket(res.access_token).then(data=>{
                const obj = ObjectHelper.parseJSON(data);
                const timestamp = Date.now();
                const nonce_str = createNonceStr()
                const signStr = `jsapi_ticket=${obj.ticket}&noncestr=${nonce_str}&timestamp=${timestamp}&url=${url}`;
                console.log(signStr);
                const sign = crypto.createHash('sha1').update(signStr).digest('hex');
    
                return Promise.resolve({
                    appid:appid,
                    nonceStr:nonce_str,
                    timestamp:timestamp,
                    signature:sign
                })
            });
        });
    }
}