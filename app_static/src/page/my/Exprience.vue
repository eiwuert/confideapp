<template>
<div class="expirence-container">
  <div class="list" @click="showPopup" >
    <mt-cell title="职业" is-link>
      <span>{{job.name}}</span>
      <i class="mint-cell-allow-right"></i>
    </mt-cell>
  </div>
  <div class="list select">
    <mt-cell title="家庭状况">
      <select v-model="family">
          <option :value="item.id" :key="index" v-for="(item,index) in Familys">{{item.name}}</option>
      </select>
      <i class="mint-cell-allow-right"></i>
    </mt-cell>
  </div>
  <div class="list select">
    <mt-cell title="最高学历">
      <select v-model="edu">
          <option :value="item.id" :key="index" v-for="(item,index) in Edus">{{item.name}}</option>
      </select>
      <i class="mint-cell-allow-right"></i>
    </mt-cell>
  </div>
  <mt-button class="next" @click="goSelectTag" size="normal" type="primary">下一步</mt-button>
  <mt-popup
    v-model="popupVisible"
    position="right">
    <two-level-menu :lists="Jobs" v-if="Jobs.length" @changeMenu="updateJob"></two-level-menu>
  </mt-popup>
</div>
</template>

<script lang="ts">
import Vue from 'vue'
import {Component} from 'vue-property-decorator';
import { EBaseDataType } from '../../enum/EBaseDataType';
import UserService from "../../api/UserService";
import { mapActions } from 'vuex';
import {INoop} from "../../util/methods"
import TwoLevelMenu from '@/components/TwoLevelMenu'
@Component({
  components:{
    TwoLevelMenu
  },
  methods:{
    ...mapActions({
      setExprience:'my/setExprience'
    })
  }
})
export default class Exprience extends Vue{
  private service = UserService.getInstance()
  private setExprience:INoop
  private job:any = {};
  private Jobs:Array<{code:string,name:string}> = [];
  private family = '';
  private Familys:Array<{code:string,name:string}> = []
  private edu = '';
  private Edus:Array<{code:string,name:string}> = [];
  private popupVisible = false;
  goSelectTag(){
    if(this.job&&this.family&&this.edu){
      let expirence = {
        job:this.job.id,
        family:this.family,
        edu:this.edu
      }
      this.setExprience(expirence)
      this.$router.replace({path:'/tag'})
    }else{
      this.$toast("信息不能为空");
    }
  }
  created(){
    document.title = "经历"
    this.filterFunc('Job')
    this.filterFunc('Family')
    this.filterFunc('Edu')
  }
  filterFunc(type:string){
    this.service.getBase(EBaseDataType[type]).then(res=>{
      let data = res.data.data;
      this[type+'s'] = data;
    })
  }
  showPopup(){
    this.popupVisible = true;
  }
  updateJob(job:any){
    this.job = job;
    this.popupVisible = false;
  }
}
</script>

<style lang="less">
@bg:#f5f5f5;
@mainColor:#00D1CF;
.expirence-container .select .mint-cell-value{
  flex:2 !important;
}
.expirence-container{
  background:@bg;
  font-size:1.4rem;
  // height:100vh;
  -webkit-tap-highlight-color: rgba(0,0,0,0);
  .mint-popup{
    width:100%;
    height:100%;
  }
  .list{
    text-align:left;
    padding-left:1rem;
    background:#fff;
    &:last-child{
      .mint-cell{
        border:none;
      }
    }
    select{
      width:100%;
      border:none;
      height:48px;
      appearance:none;
      -moz-appearance:none;
      -webkit-appearance:none;
      background-image: none;
      background: no-repeat scroll right center transparent;
      margin-right:25px;
      color:#888;
      font-size:1.4rem;
      direction: rtl;
    }
  }
  .next{
    width:12rem;
    height:4rem;
    line-height: 4rem;
    text-align: center;
    color:#fff;
    background:@mainColor;
    border-radius:.3rem;
    position:fixed;
    bottom:2rem;
    left:50%;
    margin-left:-6rem;
  }
}
</style>


