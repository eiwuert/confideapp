"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Payment = require('wechat-pay').Payment;
const wxconfig = require("../../config/wxconfig.json");
const globalconfig = require("../../config/globalconfig.json");
const origin = globalconfig.origin;
exports.initConfig = {
    partnerKey: wxconfig.appkey,
    appId: wxconfig.appid,
    mchId: wxconfig.mch_id,
    notifyUrl: `${origin}/pay/payaction`,
};
const payment = new Payment(exports.initConfig);
class WxPayHelper {
    /**
     * 支付
     * @param ip
     * @param openid
     * @param orderNo
     * @param total_fee
     */
    pay(ip, openid, orderNo, total_fee) {
        const order = {
            body: '千寻倾听支付',
            attach: '千寻倾听支付',
            out_trade_no: orderNo,
            total_fee: total_fee * 100,
            spbill_create_ip: '172.5.20.6',
            openid: openid,
            trade_type: 'JSAPI'
        };
        return new Promise((resolve, reject) => {
            payment.getBrandWCPayRequestParams(order, function (err, payargs) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(payargs);
            });
        });
    }
    /**
     * 退款
     * @param orderNo
     * @param total_fee
     */
    refund(orderNo, total_fee) {
        return new Promise((resolve, reject) => {
            payment.refund({
                out_trade_no: orderNo,
                out_refund_no: orderNo + '_refund',
                total_fee: total_fee,
                refund_fee: total_fee,
                notify_url: "${origin}/pay/payrefound"
            }, function (err, result) {
                /**
                 * 微信收到正确的请求后会给用户退款提醒
                 * 这里一般不用处理，有需要的话有err的时候记录一下以便排查
                 */
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }
    constructor() {
    }
    static createInstance() {
        WxPayHelper.getInstance();
    }
    static getInstance() {
        return this._instance || (this._instance = new this());
    }
}
exports.default = WxPayHelper;
