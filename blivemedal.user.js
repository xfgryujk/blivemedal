// ==UserScript==
// @name         blivemedal
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  拯救B站直播换牌子的用户体验
// @author       xfgryujk
// @include      /https?:\/\/live\.bilibili\.com\/?\??.*/
// @include      /https?:\/\/live\.bilibili\.com\/\d+\??.*/
// @include      /https?:\/\/live\.bilibili\.com\/(blanc\/)?\d+\??.*/
// @require      https://cdn.jsdelivr.net/npm/axios@0.21.0/dist/axios.min.js
// @grant        none
// ==/UserScript==

(function() {
  function main() {
    initLib()
    initCss()
    waitForLoaded(initUi)
  }

  function initLib() {
    let scriptElement = document.createElement('script')
    scriptElement.src = 'https://cdn.jsdelivr.net/npm/vue@2.6.12/dist/vue.js'
    document.head.appendChild(scriptElement)

    let linkElement = document.createElement('link')
    linkElement.rel = 'stylesheet'
    linkElement.href = 'https://unpkg.com/element-ui@2.14.1/lib/theme-chalk/index.css'
    document.head.appendChild(linkElement)
    
    scriptElement = document.createElement('script')
    scriptElement.src = 'https://unpkg.com/element-ui@2.14.1/lib/index.js'
    document.head.appendChild(scriptElement)
  }

  function initCss() {
    let css = `
      .medal-section {
        /*
        position: absolute !important;
        top: 50px !important;
        border-right: none !important;
        */
        /* 屏蔽原来的牌子按钮 */
        display: none !important;
      }
    `
    let styleElement = document.createElement('style')
    styleElement.innerText = css
    document.head.appendChild(styleElement)
  }

  function waitForLoaded(callback, timeout=10 * 1000) {
    let startTime = new Date()
    function poll() {
      if (isLoaded()) {
        callback()
        return
      }

      if (new Date() - startTime > timeout) {
        return
      }
      setTimeout(poll, 1000)
    }
    poll()
  }

  function isLoaded() {
    if (window.ELEMENT === undefined) {
      return false
    }
    if (document.querySelector('#control-panel-ctnr-box') === null) {
      return false
    }
    return true
  }

  function initUi() {
    let panelElement = document.querySelector('#control-panel-ctnr-box')
    let myMedalButtonElement = document.createElement('div')
    panelElement.appendChild(myMedalButtonElement)

    new Vue({
      el: myMedalButtonElement,
      components: {
        MedalDialog
      },
      template: `
        <div>
          <el-button type="primary" style="font-size: 12px; min-width: 80px; height: 24px; padding: 6px 12px;"
            @click="showMedalDialog"
          >勋章</el-button>
          <medal-dialog ref="medalDialog"></medal-dialog>
        </div>
      `,
      methods: {
        showMedalDialog() {
          this.$refs.medalDialog.showDialog()
        }
      }
    })
  }

  let MedalDialog = {
    name: 'MedalDialog',
    template: `
      <el-dialog :visible.sync="dialogVisible" title="我的粉丝勋章" width="850px" :modal="false">
        <el-table :data="sortedMedals" stripe height="70vh">
          <el-table-column label="勋章" prop="medal_name" width="100" sortable
            :sort-method="(a, b) => a.medal_name.localeCompare(b.medal_name)"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.is_lighted ? '' : 'info'">{{ scope.row.medal_name }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="等级" prop="level" width="80" sortable></el-table-column>
          <el-table-column label="主播昵称" prop="target_name" width="200" sortable
            :sort-method="(a, b) => a.target_name.localeCompare(b.target_name)"
          >
            <template slot-scope="scope">
              <el-link type="primary" :underline="false" target="_blank" :href="'https://live.bilibili.com/' + scope.row.roomid">
                {{ scope.row.target_name }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="亲密度/原力值" prop="intimacy" width="140" sortable>
            <template slot-scope="scope">
              {{ scope.row.intimacy }} / {{ scope.row.next_intimacy }}
            </template>
          </el-table-column>
          <el-table-column label="本日亲密度/原力值" prop="today_intimacy" width="160" sortable>
            <template slot-scope="scope">
              {{ scope.row.today_intimacy }} / {{ scope.row.day_limit }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template slot-scope="scope">
              <el-button v-if="curMedal !== null && scope.row.medal_id === curMedal.medal_id"
                type="primary" size="mini" @click="takeOffMedal"
              >取消佩戴</el-button>
              <el-button v-else type="primary" size="mini" @click="wearMedal(scope.row)">佩戴</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-dialog>
    `,
    data() {
      return {
        dialogVisible: false,
        medals: [],
        curMedal: null
      }
    },
    computed: {
      sortedMedals() {
        let curMedal = []
        let curRoomMedal = []
        let medals = []
        for (let medal of this.medals) {
          if (this.curMedal !== null && medal.medal_id === this.curMedal.medal_id) {
            curMedal.push(medal)
          } else if (medal.roomid === window.__NEPTUNE_IS_MY_WAIFU__.roomInfoRes.data.room_info.room_id) {
            curRoomMedal.push(medal)
          } else {
            medals.push(medal)
          }
        }
        // 剩下的按上次佩戴时间降序排序
        medals.sort((a, b) => b.last_wear_time - a.last_wear_time)
        console.log(curMedal, curRoomMedal, medals)
        return [...curMedal, ...curRoomMedal, ...medals]
      }
    },
    methods: {
      showDialog() {
        this.updateMedals()
        this.updateCurMedal()
        this.dialogVisible = true
      },
      async updateMedals() {
        let rsp
        try {
          rsp = (await axios.get('http://api.live.bilibili.com/fans_medal/v5/live_fans_medal/iApiMedal?page=1&pageSize=1000', {
            withCredentials: true
          })).data
          if (rsp.code !== 0) {
            throw rsp.message
          }
        } catch (e) {
          this.$message.error(e)
          return
        }
        this.medals = rsp.data.fansMedalList
      },
      async updateCurMedal() {
        let rsp
        try {
          rsp = (await axios.get('https://api.live.bilibili.com/live_user/v1/UserInfo/get_weared_medal', {
            withCredentials: true
          })).data
          if (rsp.code !== 0) {
            throw rsp.message
          }
        } catch (e) {
          this.$message.error(e)
          return
        }
        let curMedal = rsp.data
        if (curMedal.medal_id === undefined) {
          // 没佩戴牌子
          curMedal = null
        }
        this.curMedal = curMedal
      },
      async wearMedal(medal) {
        let csrfToken = getCsrfToken()
        let data = new FormData()
        data.append('medal_id', medal.medal_id)
        data.append('csrf_token', csrfToken)
        data.append('csrf', csrfToken)
        try {
          let rsp = (await axios.post(
            'https://api.live.bilibili.com/xlive/web-room/v1/fansMedal/wear', data, { withCredentials: true }
          )).data
          if (rsp.code !== 0) {
            throw rsp.message
          }
        } catch (e) {
          this.$message.error(e)
          return
        }
        this.updateCurMedal()
      },
      async takeOffMedal() {
        let csrfToken = getCsrfToken()
        let data = new FormData()
        data.append('csrf_token', csrfToken)
        data.append('csrf', csrfToken)
        try {
          let rsp = (await axios.post(
            'https://api.live.bilibili.com/xlive/web-room/v1/fansMedal/take_off', data, { withCredentials: true }
          )).data
          if (rsp.code !== 0) {
            throw rsp.message
          }
        } catch (e) {
          this.$message.error(e)
          return
        }
        this.updateCurMedal()
      }
    }
  }

  function getCsrfToken() {
    let match = document.cookie.match(/bili_jct=(.+?)[;$]/)
    if (match === null) {
      return ''
    }
    return match[1]
  }

  main()
})();
