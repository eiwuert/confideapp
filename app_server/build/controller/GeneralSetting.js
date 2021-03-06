"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GeneralSetting_1 = require("../model/GeneralSetting");
const Bluebird = require("bluebird");
const ErrorMsg_1 = require("../model/ErrorMsg");
const _ = require("lodash");
const EGeneralStatus_1 = require("../enum/EGeneralStatus");
// import ListenerService from "./Listener";
const MongoHomeClickRate_1 = require("../model/mongo/MongoHomeClickRate");
const CalucateService_1 = require("../helper/CalucateService");
const User_1 = require("./User");
/**
 * 推广设置
 */
class GeneralSettingService {
    constructor() {
        this.userService = User_1.default.getInstance();
    }
    getGeneral(uid) {
        if (!uid) {
            return Bluebird.reject(new ErrorMsg_1.default(false, "用户id不能为空"));
        }
        return GeneralSetting_1.default.find({
            where: {
                uid: uid
            }
        });
    }
    enableGeneral(status, userid) {
        const values = Object.keys(EGeneralStatus_1.EGeneralStatus);
        if (!userid) {
            return Bluebird.reject(new ErrorMsg_1.default(false, "用户id不能为空"));
        }
        const tempStatus = parseInt(status);
        if (!(tempStatus in values)) {
            return Bluebird.reject(new ErrorMsg_1.default(false, "状态非法"));
        }
        return GeneralSetting_1.default.update({
            status: tempStatus
        }, {
            where: {
                uid: userid
            }
        });
    }
    setGeneral(generalSetting) {
        if (!generalSetting.uid) {
            return Bluebird.reject(new ErrorMsg_1.default(false, "用户id不能为空"));
        }
        if (!_.isNumber(generalSetting.price) || !generalSetting.price) {
            return Bluebird.reject(new ErrorMsg_1.default(false, "价格参数非法"));
        }
        if ('limitprice' in generalSetting && !_.isNumber(generalSetting.limitprice)) {
            return Bluebird.reject(new ErrorMsg_1.default(false, "推广限制必须是数字"));
        }
        if ('limitprice' in generalSetting && generalSetting.limitprice < generalSetting.price) {
            return Bluebird.reject(new ErrorMsg_1.default(false, "推广限制必须大于等于设置的推广价格"));
        }
        generalSetting.limitprice = generalSetting.limitprice || null;
        return this.userService.find(generalSetting.uid).then(res => {
            if (!res) {
                return Bluebird.reject(new ErrorMsg_1.default(false, "未找到对应用户"));
            }
            if (res.money < generalSetting.price) {
                return Bluebird.reject(new ErrorMsg_1.default(false, "当前余额不足"));
            }
            return Bluebird.resolve(res);
        }).then(res => {
            //默认启用
            generalSetting.status = EGeneralStatus_1.EGeneralStatus.Enable;
            return GeneralSetting_1.default.find({
                where: {
                    uid: generalSetting.uid
                }
            }).then(res => {
                if (res) {
                    const uid = generalSetting.uid;
                    delete generalSetting.uid;
                    return GeneralSetting_1.default.update(generalSetting, {
                        where: {
                            uid: uid
                        }
                    }).then(res => {
                        return generalSetting;
                    });
                }
                return GeneralSetting_1.default.create(generalSetting);
            });
        });
    }
    /**
     * 点击后验证推广
     * @param pid 倾诉者id
     * @param lid 倾听者id
     */
    checkGeneral(pid, lid) {
        if (pid === lid) {
            return Promise.resolve(new ErrorMsg_1.default(true));
        }
        return MongoHomeClickRate_1.default.findOne({
            pid: pid,
            lid: lid
        }).then(res => {
            let promise = null;
            if (res) {
                //当前点击过
                if (res.ldate.format("yyyy-MM-dd") === new Date().format('yyyy-MM-dd')) {
                    return Promise.resolve(new ErrorMsg_1.default(true));
                }
                promise = MongoHomeClickRate_1.default.update({
                    pid: pid,
                    lid: lid
                }, {
                    ldate: new Date()
                });
            }
            else {
                promise = MongoHomeClickRate_1.default.create({
                    pid: pid,
                    lid: lid,
                    ldate: new Date()
                });
            }
            return promise;
        }).then(res => {
            const findUserPromise = this.userService.find(lid);
            const findGeneralPromise = GeneralSetting_1.default.find({
                where: {
                    uid: lid
                }
            });
            return Bluebird.all([findUserPromise, findGeneralPromise]).then(resuls => {
                const user = resuls[0];
                const generalSetting = resuls[1];
                const restMoney = CalucateService_1.default.numSub(user.money, generalSetting.price);
                const dayprice = CalucateService_1.default.numAdd(generalSetting.dayprice, generalSetting.price);
                let promises = [];
                if (restMoney < generalSetting.price) {
                    promises.push(GeneralSetting_1.default.update({
                        dayprice,
                        status: EGeneralStatus_1.EGeneralStatus.Disable
                    }));
                }
                else {
                    /**
                     * 如果设置当日价格限制
                     * 判断当日的推广费用是否小于设置的限制
                     */
                    if (generalSetting.limitprice > 0) {
                        const dayRestPrice = generalSetting.limitprice - dayprice;
                        if (dayRestPrice < generalSetting.price) {
                            promises.push(GeneralSetting_1.default.update({
                                dayprice,
                                status: EGeneralStatus_1.EGeneralStatus.DayDisable
                            }));
                        }
                        else {
                            promises.push(GeneralSetting_1.default.update({
                                dayprice
                            }));
                        }
                    }
                    else {
                        promises.push(GeneralSetting_1.default.update({
                            dayprice
                        }));
                    }
                }
                user.money = CalucateService_1.default.numSub(user.money, generalSetting.price);
                promises.push(this.userService.update(user));
                return Promise.all(promises);
            });
        });
    }
    static createInstance() {
        GeneralSettingService.getInstance();
    }
    static getInstance() {
        return this._instance || (this._instance = new this());
    }
}
exports.default = GeneralSettingService;
