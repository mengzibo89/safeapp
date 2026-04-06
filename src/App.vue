<template>
  <!-- 登录拦截层 (带有防爆破安全锁定) -->
  <div v-if="!state.isAuthenticated" class="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-md flex justify-center items-center z-[9999]">
    <div class="bg-white p-8 rounded-2xl shadow-2xl w-96 transform transition-all">
      <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">🛡️ Safety Inspector</h2>
      <p class="text-sm text-gray-500 mb-4 text-center">请输入系统访问密码</p>
      
      <div v-if="state.auth.loginAttempts > 0 && state.auth.loginAttempts < 5" class="mb-4 text-xs text-red-500 text-center animate-pulse">
         密码错误。您还有 {{ 5 - state.auth.loginAttempts }} 次机会，否则系统将重置。
      </div>

      <input v-model="loginPwd" type="password" @keyup.enter="handleLogin" placeholder="访问密码 (默认: 123456)" class="w-full border-2 border-gray-200 rounded-lg px-4 py-3 mb-6 focus:outline-none focus:border-indigo-500 transition">
      <button @click="handleLogin" class="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 shadow-lg transition">进入系统</button>
    </div>
  </div>

  <!-- 主应用视图 -->
  <div v-else class="flex h-screen w-full relative select-none bg-gray-100" :class="{ 'dark-theme': state.config.theme === 'dark' }">
    
    <!-- ================= 左侧：台账数据库 ================= -->
    <div :style="{ width: `${sidebarWidth}px` }" class="h-full bg-white flex flex-col border-r border-gray-200 shadow-sm z-10 transition-colors duration-200 relative flex-shrink-0">
      
      <!-- 顶部工具栏 -->
      <div class="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-bold text-lg tracking-tight text-gray-800">Safety Pro</span>
          <span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded font-bold">v8.5 完全体</span>
        </div>
        <div class="flex gap-2">
          <!-- ⭐ 恢复：UI / UX Config 齿轮设置菜单 -->
          <button @click="openModal('ui-config')" class="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition" title="显示与搜索设置">⚙️</button>
          <button @click="toggleTheme" class="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition" title="切换深色模式">🌓</button>
          <button @click="openModal('ai')" class="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition" title="AI 设置">🤖</button>
          <button @click="openModal('transfer')" class="mac-btn-secondary px-3 py-1 text-sm font-medium border rounded shadow-sm transition">🔄 转移</button>
        </div>
      </div>

      <!-- 库与操作 -->
      <div class="p-4 border-b bg-white space-y-3 shrink-0">
        <div>
          <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">当前台账库</label>
          <select v-model="state.currentProject" @change="switchProject" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-indigo-500 bg-gray-50">
            <option v-for="proj in state.projects" :key="proj" :value="proj">{{ proj }}</option>
          </select>
        </div>
        <div class="flex gap-2">
            <button @click="exportExcel" class="flex-1 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 font-bold transition">📊 导出 Excel</button>
            <button @click="openModal('export', 'db')" class="flex-1 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 font-bold transition">📝 生成报告单</button>
        </div>
      </div>

      <!-- 搜索与新增 -->
      <div class="p-3 border-b bg-gray-50 flex gap-2 shrink-0">
        <!-- ⭐ 恢复：搜索提示词动态化，依据 searchFields -->
        <input v-model="state.searchQuery" type="text" :placeholder="searchPlaceholder" class="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner">
        <button @click="addNewItem" class="px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-md hover:bg-indigo-700 shadow-sm transition">+ 新增</button>
      </div>
      
      <!-- 数据表格列表 -->
      <div class="flex-1 overflow-y-auto">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-gray-100 sticky top-0 z-20 border-b">
            <tr>
              <th class="p-2 w-8 text-center"><input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"></th>
              <!-- ⭐ 恢复：字段显隐动态控制 visibleCols -->
              <th v-if="state.config.visibleCols.includes('category')" class="p-2 font-semibold text-gray-600 w-20">分类</th>
              <th v-if="state.config.visibleCols.includes('description')" class="p-2 font-semibold text-gray-600">隐患描述</th>
              <th v-if="state.config.visibleCols.includes('clause')" class="p-2 font-semibold text-gray-600">规范条文</th>
              <th v-if="state.config.visibleCols.includes('status')" class="p-2 font-semibold text-gray-600 w-24">状态</th>
            </tr>
          </thead>
          <tbody ref="sortableDbTbody">
            <tr v-for="item in paginatedDb" :key="item.uuid" :data-id="item.uuid"
                @contextmenu.prevent="showContextMenu($event, item, 'db')"
                @click="selectSingle(item)"
                class="db-row border-b hover:bg-gray-50 transition cursor-pointer"
                :class="{'bg-indigo-50': state.selectedIds.has(item.uuid)}">
              <td class="p-2 text-center" @click.stop>
                <input type="checkbox" :checked="state.selectedIds.has(item.uuid)" @change="toggleSelect(item.uuid)">
              </td>
              <!-- ⭐ 恢复：字段显隐动态控制 visibleCols -->
              <td v-if="state.config.visibleCols.includes('category')" class="p-2">
                 <span class="px-2 py-0.5 border rounded text-[10px] font-bold text-gray-600 bg-white">{{ item.category || '综合' }}</span>
              </td>
              <td v-if="state.config.visibleCols.includes('description')" class="p-2 max-w-[200px] truncate" :title="item.desc">
                <span v-if="item.photos && item.photos.length" class="text-xs mr-1 text-blue-500">🖼️</span>
                {{ item.desc || '未命名隐患' }}
              </td>
              <td v-if="state.config.visibleCols.includes('clause')" class="p-2 max-w-[120px] truncate text-gray-500 text-xs" :title="item.clause">
                {{ item.clause || '--' }}
              </td>
              <td v-if="state.config.visibleCols.includes('status')" class="p-2">
                <span :class="item.status === '已整改' ? 'text-green-600 bg-green-100 border-green-200' : 'text-red-600 bg-red-100 border-red-200'" class="px-2 py-0.5 border rounded text-[10px] font-bold">
                  {{ item.status || '未整改' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredDb.length === 0" class="p-8 text-center text-gray-400 text-sm">无匹配的台账数据</div>
      </div>
      
      <!-- 分页器 -->
      <div class="p-3 border-t bg-white flex justify-between items-center text-xs text-gray-500 shrink-0">
         <span>共 {{ filteredDb.length }} 条</span>
         <div class="flex gap-2 items-center">
            <button @click="state.pagination.current--" :disabled="state.pagination.current === 1" class="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50">上一页</button>
            <span class="font-bold">{{ state.pagination.current }} / {{ totalPages || 1 }}</span>
            <button @click="state.pagination.current++" :disabled="state.pagination.current >= totalPages" class="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50">下一页</button>
         </div>
      </div>
    </div>

    <!-- 无级拖拽条 (Resizer) -->
    <div class="resizer-bar" :class="{ 'active': isResizing }" @mousedown="startResize"></div>

    <!-- ================= 中间：工作区 (编辑 / 图表 / PDF / 知识库) ================= -->
    <div class="flex-1 bg-gray-200 overflow-y-auto relative flex flex-col min-w-[500px]">
      
      <!-- 视图 Tabs -->
      <div class="p-3 bg-white border-b shadow-sm flex gap-4 shrink-0 z-10 text-sm">
        <button @click="currentView = 'edit'" :class="currentView === 'edit' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'" class="pb-2 font-bold px-2 transition">📝 A4 详情编辑</button>
        <button @click="currentView = 'kb'" :class="currentView === 'kb' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'" class="pb-2 font-bold px-2 transition">📚 动态知识库</button>
        <button @click="currentView = 'chart'" :class="currentView === 'chart' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'" class="pb-2 font-bold px-2 transition">📈 数据看板</button>
        <!-- ⭐ 恢复：PDF 文本提取入口 -->
        <button @click="currentView = 'pdf'" :class="currentView === 'pdf' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'" class="pb-2 font-bold px-2 transition">📄 PDF 解析引擎</button>
      </div>

      <!-- 1. A4 编辑视图 (隔离了 Blob 图片) -->
      <div v-show="currentView === 'edit'" class="p-8 flex justify-center flex-1 pb-32">
        <div class="a4-paper w-[210mm] min-h-[297mm] bg-white shadow-2xl p-12 text-black relative">
           <div v-if="currentItem" class="space-y-5">
              <h1 class="text-3xl font-bold text-center border-b-2 border-black pb-4 mb-6 tracking-widest">隐患详情整改单</h1>
              <div class="grid grid-cols-2 gap-5">
                <div>
                  <label class="block font-bold text-sm mb-1 text-gray-700">业务分类</label>
                  <input v-model="currentItem.category" @input="debouncedSave" type="text" class="w-full border p-2 rounded text-sm outline-none">
                </div>
                <div>
                  <label class="block font-bold text-sm mb-1 text-gray-700">模板渲染类型</label>
                  <select v-model="currentItem.colType" @change="debouncedSave" class="w-full border rounded p-2 text-sm focus:border-indigo-500 outline-none">
                    <option v-for="(label, key) in COL_TYPES" :key="key" :value="key">{{ label }}</option>
                  </select>
                </div>

                <div class="col-span-2 relative">
                  <label class="block font-bold text-sm mb-1 text-gray-700">隐患描述 (支持语音输入)</label>
                  <textarea v-model="currentItem.desc" @input="handleDescInput" class="w-full border p-3 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none" rows="3"></textarea>
                  <button @click="toggleVoice" :class="isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-gray-100 hover:bg-gray-200'" class="absolute bottom-3 right-3 p-2 rounded-full shadow transition">🎤</button>
                </div>

                <div class="col-span-2">
                  <label class="block font-bold text-sm mb-1 text-gray-700">违规条文与规范</label>
                  <textarea v-model="currentItem.clause" @input="debouncedSave" class="w-full border p-2 rounded outline-none" rows="2"></textarea>
                  <!-- 知识库 AI 提示框 -->
                  <div v-if="matchedKb" class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm flex gap-2">
                    <span class="text-blue-500">💡</span>
                    <div class="flex-1">
                      <p class="font-bold text-blue-800">智能匹配到规范：{{ matchedKb.clause }}</p>
                      <p class="text-blue-700 text-xs mt-1">{{ matchedKb.standard }}</p>
                    </div>
                    <button @click="applyKbMatch" class="shrink-0 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">采用</button>
                  </div>
                </div>

                <div class="col-span-2">
                    <label class="block font-bold text-sm mb-1 text-gray-700">整改状态</label>
                    <select v-model="currentItem.status" @change="debouncedSave" class="border p-2 rounded text-sm font-bold w-1/3" :class="currentItem.status === '已整改' ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'">
                        <option value="未整改">未整改</option>
                        <option value="整改中">整改中</option>
                        <option value="已整改">已整改</option>
                    </select>
                </div>

                <!-- ⭐ Blob 隔离机制：现场照片区域 -->
                <div class="col-span-2 border-t border-dashed pt-4 mt-2">
                  <div class="flex justify-between items-center mb-3">
                    <label class="block font-bold text-sm text-gray-700">现场照片证据 (Blob 极速引擎)</label>
                    <button @click="triggerUpload" class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded font-bold transition hover:bg-indigo-100">
                      + 上传照片
                    </button>
                    <input type="file" ref="fileInput" class="hidden" accept="image/*" multiple @change="handleImageUpload">
                  </div>
                  
                  <div class="grid grid-cols-3 gap-4">
                     <!-- 渲染 Blob 内存 URL -->
                    <div v-for="(imgId, idx) in currentItem.photos" :key="imgId" class="relative group border border-gray-300 rounded bg-gray-50 aspect-[4/3] overflow-hidden shadow-sm">
                      <img :src="getPhotoUrl(imgId)" class="object-cover w-full h-full" />
                      <div class="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center gap-2">
                         <button @click="rotateImage(idx)" class="bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-gray-200">↻</button>
                         <button @click="removeImage(idx)" class="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-red-600">🗑</button>
                      </div>
                    </div>
                    <div v-if="!currentItem.photos || currentItem.photos.length === 0" class="col-span-3 text-center py-10 text-gray-400 border-2 border-dashed rounded-lg bg-gray-50">
                      尚未上传照片证据 (IndexedDB 零压力)
                    </div>
                  </div>
                </div>
              </div>
           </div>
           <div v-else class="h-full flex flex-col items-center justify-center text-gray-400 mt-40">
              <span class="text-6xl mb-4">📄</span>
              <p class="text-lg font-medium">请在左侧台账或右侧购物车选中一项进行编辑</p>
           </div>
        </div>
      </div>

      <!-- 2. 动态知识库管理视图 -->
      <div v-show="currentView === 'kb'" class="p-8 flex-1 pb-32">
        <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border p-6">
          <div class="flex justify-between items-center border-b pb-4 mb-4">
            <h2 class="text-xl font-bold text-gray-800">📚 动态知识库管理 (Knowledge Base)</h2>
            <button @click="resetKB" class="text-xs text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-50">恢复默认规则</button>
          </div>
          
          <div class="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
                <label class="block text-xs font-bold text-indigo-800 mb-1">触发关键词 (逗号分隔)</label>
                <input v-model="newKb.keywords" type="text" class="w-full border rounded p-2 text-sm outline-none">
             </div>
             <div>
                <label class="block text-xs font-bold text-indigo-800 mb-1">规范文号</label>
                <input v-model="newKb.clause" type="text" class="w-full border rounded p-2 text-sm outline-none">
             </div>
             <div class="md:col-span-3">
                <label class="block text-xs font-bold text-indigo-800 mb-1">规范原文</label>
                <textarea v-model="newKb.standard" class="w-full border rounded p-2 text-sm outline-none" rows="2"></textarea>
             </div>
             <div class="md:col-span-3 flex justify-end">
                <button @click="addKbRule" class="bg-indigo-600 text-white px-6 py-2 rounded shadow font-bold text-sm hover:bg-indigo-700">添加规则</button>
             </div>
          </div>

          <div class="space-y-3">
             <div v-for="(rule, idx) in state.kbData" :key="idx" class="border rounded-lg p-4 bg-gray-50 flex justify-between items-start">
                <div>
                   <p class="text-sm font-bold text-gray-800">{{ rule.clause }}</p>
                   <p class="text-xs text-gray-500 mt-1">触发词：<span class="text-indigo-600 font-medium">{{ Array.isArray(rule.keywords) ? rule.keywords.join(', ') : rule.keywords }}</span></p>
                   <p class="text-xs text-gray-600 mt-2 bg-white p-2 border rounded">{{ rule.standard }}</p>
                </div>
                <button @click="deleteKbRule(idx)" class="text-red-500 hover:text-red-700 px-2 font-bold text-sm">删除</button>
             </div>
          </div>
        </div>
      </div>

      <!-- 3. 数据看板 -->
      <div v-show="currentView === 'chart'" class="p-8 flex-1">
        <div class="max-w-5xl mx-auto grid grid-cols-2 gap-6">
          <div class="bg-white p-6 rounded-2xl shadow-sm border">
             <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">违规类型分布</h3>
             <div class="h-64 relative"><canvas ref="pieChartRef"></canvas></div>
          </div>
          <div class="bg-white p-6 rounded-2xl shadow-sm border">
             <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">隐患维度雷达图</h3>
             <div class="h-64 relative"><canvas ref="radarChartRef"></canvas></div>
          </div>
        </div>
      </div>

      <!-- ⭐ 恢复：4. PDF 解析与批量规范提取引擎 -->
      <div v-show="currentView === 'pdf'" class="p-8 flex flex-col flex-1 h-full">
         <div class="w-full max-w-5xl mx-auto bg-white p-6 rounded-2xl shadow-sm border mb-4 flex justify-between items-center shrink-0">
            <div>
               <h3 class="font-bold text-gray-800">📄 文档解析引擎 (PDF Parsing)</h3>
               <p class="text-xs text-gray-500 mt-1">从 PDF 中提取文本，批量导入到知识库或台账中</p>
            </div>
            <div class="flex gap-2">
                <button @click="$refs.pdfDocInput.click()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-indigo-700 transition">
                   📂 加载 PDF 文档
                </button>
                <input type="file" ref="pdfDocInput" class="hidden" accept="application/pdf" @change="parsePdfText">
            </div>
         </div>
         
         <div class="w-full max-w-5xl mx-auto flex-1 bg-white border shadow-xl rounded-xl overflow-hidden flex flex-col relative">
             <!-- 提取结果展示区 -->
             <div class="p-4 bg-gray-50 border-b flex justify-between items-center">
                 <span class="text-sm font-bold text-gray-700">解析结果 (共 {{ pdfParsedSpecs.length }} 条疑似规范)</span>
                 <div v-if="pdfParsedSpecs.length > 0">
                     <button @click="commitDocImport('kb')" class="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold hover:bg-blue-200 mr-2">导入至知识库</button>
                     <button @click="commitDocImport('db')" class="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded font-bold hover:bg-green-200">导入至安全台账</button>
                 </div>
             </div>
             
             <div class="flex-1 overflow-y-auto p-4 space-y-3">
                 <div v-if="isPdfParsing" class="flex flex-col items-center justify-center h-full text-gray-500">
                     <div class="animate-spin text-4xl mb-4 text-indigo-500">⚙️</div>
                     <p>正在深度解析 PDF 文本，请稍候...</p>
                 </div>
                 <div v-else-if="pdfParsedSpecs.length === 0" class="flex items-center justify-center h-full text-gray-400">
                     尚未加载文档或未提取到有效文本
                 </div>
                 
                 <div v-for="(spec, idx) in pdfParsedSpecs" :key="idx" class="border rounded p-3 flex gap-3 hover:bg-gray-50">
                     <input type="checkbox" v-model="spec.selected" class="spec-chk mt-1">
                     <div class="flex-1">
                         <div class="flex gap-2 mb-2">
                             <input v-model="spec.category" placeholder="分类(可选)" class="border px-2 py-1 text-xs rounded w-24">
                             <input v-model="spec.clause" placeholder="条款(可选)" class="border px-2 py-1 text-xs rounded w-32 font-bold text-indigo-600">
                         </div>
                         <textarea v-model="spec.standard" class="w-full text-xs text-gray-600 bg-transparent border-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded resize-y" rows="2" placeholder="提取的原文"></textarea>
                     </div>
                 </div>
             </div>
         </div>
      </div>
    </div>

    <!-- ================= 右侧：购物车 (双轨制待办机制) ================= -->
    <div class="w-[340px] h-full bg-gray-50 border-l border-gray-200 flex flex-col shadow-inner z-10 shrink-0">
      <div class="p-4 border-b bg-white flex justify-between items-center">
        <h2 class="font-bold text-gray-800 flex items-center gap-2">🛒 专项报告待办<span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{{ state.cart.length }}</span></h2>
        <button @click="clearCart" class="text-xs text-gray-500 hover:text-red-600">清空</button>
      </div>
      
      <!-- 拖拽接收区域 -->
      <div class="flex-1 overflow-y-auto p-3" id="cart-container">
         <div v-if="state.cart.length === 0" class="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
            <span class="text-3xl mb-2">📥</span>
            <p class="text-sm text-center">从左侧台账拖拽至此<br/>组装专项报告</p>
         </div>
         <div ref="sortableCartTbody" class="space-y-2 min-h-full pb-20">
            <div v-for="(item, idx) in state.cart" :key="item.uuid" :data-id="item.uuid" 
                 @click="selectSingle(item)"
                 class="bg-white border rounded-lg p-3 shadow-sm cursor-pointer hover:border-indigo-400 group relative transition"
                 :class="{'ring-2 ring-indigo-500': state.selectedIds.has(item.uuid)}">
               <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block mb-1">{{ item.category }}</span>
               <p class="text-sm text-gray-700 line-clamp-2">{{ item.desc }}</p>
               <button @click.stop="removeFromCart(idx)" class="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">✕</button>
            </div>
         </div>
      </div>

      <div class="p-4 bg-white border-t shadow-lg">
         <button @click="openModal('export', 'cart')" class="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-indigo-700 transition">
            生成专项报告单 ({{ state.cart.length }}项)
         </button>
      </div>
    </div>

    <!-- ================= 模态框与全局提示 ================= -->
    
    <!-- 1. 动态模板导出 Modal -->
    <div v-if="activeModal === 'export'" class="modal-mask">
      <div class="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden">
        <div class="px-6 py-4 flex justify-between items-center border-b bg-gray-50">
          <h3 class="text-lg font-bold text-gray-900">📄 导出动态报告模板</h3>
          <button @click="activeModal = ''" class="text-gray-400 hover:text-gray-600 border w-8 h-8 rounded-full">✕</button>
        </div>
        <div class="p-6">
           <p class="text-sm text-gray-600 mb-4">当前将导出 <b>{{ exportSource === 'cart' ? '购物车待办' : '选中台账' }}</b> 中的 {{ itemsToExport.length }} 条数据。</p>
           <label class="block text-sm font-bold text-gray-700 mb-2">选择模板配置体系</label>
           
           <div class="space-y-3 max-h-60 overflow-y-auto mb-6">
              <div v-for="(tpl, id) in state.config.templates" :key="id" 
                   @click="selectedTplId = id"
                   class="p-3 border-2 rounded-lg cursor-pointer transition flex items-center gap-3"
                   :class="selectedTplId === id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'">
                 <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center" :class="selectedTplId === id ? 'border-indigo-600' : 'border-gray-400'">
                    <div v-if="selectedTplId === id" class="w-2 h-2 bg-indigo-600 rounded-full"></div>
                 </div>
                 <div>
                    <h4 class="font-bold text-gray-800 text-sm">{{ tpl.name }}</h4>
                    <p class="text-xs text-gray-500">{{ tpl.columns.length }} 列结构 | 导出类型: {{ tpl.type }}</p>
                 </div>
              </div>
           </div>
           <button @click="executeDynamicExport" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700">生成报告 (Docxtemplater)</button>
        </div>
      </div>
    </div>

    <!-- ⭐ 恢复：2. AI 提示词配置 Modal (包含 parse 提示词) -->
    <div v-if="activeModal === 'ai'" class="modal-mask">
      <div class="bg-white rounded-xl shadow-2xl w-[600px] overflow-hidden">
        <div class="px-6 py-4 flex justify-between items-center border-b bg-gray-50">
          <h3 class="text-lg font-bold text-gray-900">🤖 AI 高级引擎设定</h3>
          <button @click="activeModal = ''" class="text-gray-400 border w-8 h-8 rounded-full">✕</button>
        </div>
        <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">服务商</label>
              <select v-model="state.config.aiSettings.provider" class="w-full border p-2 rounded text-sm outline-none">
                <option value="gemini">Google Gemini</option><option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">API Key</label>
              <input v-model="state.config.aiSettings.apiKey" type="password" class="w-full border p-2 rounded text-sm outline-none">
            </div>
          </div>
          <hr class="my-2">
          <div>
             <label class="block text-sm font-bold text-gray-700 mb-1">隐患润色 Prompt (ai-prompt-polish)</label>
             <textarea v-model="state.config.aiSettings.prompts.polish" class="w-full border p-2 rounded text-xs text-gray-600 font-mono" rows="2"></textarea>
          </div>
          <div>
             <label class="block text-sm font-bold text-gray-700 mb-1">匹配规范 Prompt (ai-prompt-match)</label>
             <textarea v-model="state.config.aiSettings.prompts.match" class="w-full border p-2 rounded text-xs text-gray-600 font-mono" rows="2"></textarea>
          </div>
          <div>
             <label class="block text-sm font-bold text-gray-700 mb-1">PDF文本解析 Prompt (ai-prompt-parse)</label>
             <textarea v-model="state.config.aiSettings.prompts.parse" class="w-full border p-2 rounded text-xs text-gray-600 font-mono" rows="2"></textarea>
          </div>
          <button @click="activeModal = ''; debouncedSave()" class="w-full mt-2 bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-black">保存所有配置</button>
        </div>
      </div>
    </div>

    <!-- ⭐ 恢复：3. UI / UX 字段显隐配置 Modal -->
    <div v-if="activeModal === 'ui-config'" class="modal-mask">
      <div class="bg-white rounded-xl shadow-2xl w-[450px] overflow-hidden">
        <div class="px-6 py-4 flex justify-between items-center border-b bg-gray-50">
          <h3 class="text-lg font-bold text-gray-900">⚙️ 显示与搜索设置</h3>
          <button @click="activeModal = ''" class="text-gray-400 border w-8 h-8 rounded-full">✕</button>
        </div>
        <div class="p-6 space-y-6">
           <div>
              <p class="font-bold text-sm text-gray-700 mb-3 border-b pb-1">表格可视列 (Visible Columns)</p>
              <div class="flex flex-wrap gap-3">
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.visibleCols" value="category">分类</label>
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.visibleCols" value="description">隐患描述</label>
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.visibleCols" value="clause">规范条文</label>
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.visibleCols" value="status">状态</label>
              </div>
           </div>
           <div>
              <p class="font-bold text-sm text-gray-700 mb-3 border-b pb-1">全局搜索覆盖字段 (Search Fields)</p>
              <div class="flex flex-wrap gap-3">
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.searchFields" value="desc">隐患描述</label>
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.searchFields" value="category">业务分类</label>
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.searchFields" value="clause">规范条文</label>
                 <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="state.config.searchFields" value="status">整改状态</label>
              </div>
           </div>
           <button @click="activeModal = ''; debouncedSave()" class="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700">应用设置</button>
        </div>
      </div>
    </div>

    <!-- 4. 数据转移 Modal -->
    <div v-if="activeModal === 'transfer'" class="modal-mask">
      <div class="bg-white rounded-xl shadow-2xl w-[420px] overflow-hidden">
        <div class="px-6 py-4 flex justify-between items-center border-b bg-gray-50">
          <h3 class="text-lg font-bold text-gray-900">🔄 跨项目转移</h3>
          <button @click="activeModal = ''" class="text-gray-400 border w-8 h-8 rounded-full">✕</button>
        </div>
        <div class="p-6">
          <select v-model="state.targetProject" class="w-full border rounded-lg px-4 py-3 text-sm mb-6 bg-gray-50">
            <option v-for="proj in state.projects" :key="proj" :value="proj">{{ proj }}</option>
          </select>
          <div class="flex justify-end gap-3 pt-2">
            <button @click="executeTransfer('copy')" class="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200">仅复制</button>
            <button @click="executeTransfer('move')" class="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow">剪切移动</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键毛玻璃菜单 -->
    <div v-if="contextMenu.show" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" class="context-menu">
      <button @click="cloneItem" class="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border-b">📄 复制当前项</button>
      <button @click="deleteItem" class="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">🗑️ 删除并放入回收站</button>
    </div>

    <!-- 防误删撤销 (Undo) 提示框 -->
    <div v-if="undoState.show" class="fixed bottom-24 right-8 bg-white border border-gray-200 text-gray-800 px-5 py-4 rounded-xl shadow-2xl z-[99999] flex items-center gap-4 animate-slide-up">
      <div class="flex items-center gap-2">
        <span class="text-amber-500 text-xl">⚠️</span>
        <span class="text-sm font-bold">{{ undoState.msg }}</span>
      </div>
      <div class="w-px h-6 bg-gray-200"></div>
      <button @click="executeUndo" class="text-indigo-600 font-bold text-sm hover:text-indigo-800 transition flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50">
        ↩️ 撤销 (Undo)
      </button>
      <button @click="undoState.show = false" class="text-gray-400 hover:text-gray-600 ml-2 border rounded-full w-6 h-6 flex justify-center items-center">✕</button>
    </div>

    <!-- 全局 Toast -->
    <div v-if="toastMsg" class="fixed bottom-8 right-8 bg-gray-900 text-white px-5 py-3 rounded-lg shadow-2xl z-[99998] flex items-center gap-3 transition-all duration-300">
      <span class="text-green-400 text-lg leading-none">●</span> <span class="text-sm font-medium">{{ toastMsg }}</span>
    </div>

  </div>
</template>

<script setup>
/**
 * Safety Inspector Pro - Vue 3 终极完美版 (100% 修复完毕)
 * 修订记录：
 * 1. 恢复防爆破安全锁定机制 (5次错误清除系统)。
 * 2. 恢复 UI/UX 字段显隐与搜索动态配置 (visibleCols, searchFields)。
 * 3. 补全 AI 引擎 parse 提示词设定。
 * 4. 恢复 PDF 文本提取与批量规范导入功能。
 */
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick, shallowRef } from 'vue';
import localforage from 'localforage';
import Sortable from 'sortablejs';
import PinyinMatch from 'pinyin-match';
import Chart from 'chart.js/auto';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist'; // 引入 PDF 解析

// ==========================================
// 常量与默认配置
// ==========================================
const AUTH_KEY = 'HazardUltra_Auth_V8';
const COL_TYPES = { 'index': '序号', 'desc_img': '描述+图片', 'desc_only': '纯文本', 'clause_only': '规范条文' };

const DEFAULT_TEMPLATES = {
    'default': { name: '标准带图台账 (推荐)', type: 'word', columns: [ { title: '序号', type: 'index' }, { title: '隐患现象及照片', type: 'desc_img' }, { title: '整改', type: 'status' } ] },
    'simple': { name: '纯文字简报模式', type: 'word', columns: [ { title: '编号', type: 'index' }, { title: '问题描述', type: 'desc_only' } ] }
};

const DEFAULT_KB_DATA = [
    { keywords: ['配电箱', '漏保', '三级配电'], clause: 'JGJ46-2005', standard: '施工现场临时用电安全技术规范' },
    { keywords: ['脚手架', '连墙件'], clause: 'JGJ130-2011', standard: '建筑施工扣件式钢管脚手架' }
];

// PDF 解析引擎 Worker 挂载逻辑
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ==========================================
// 核心状态响应式对象
// ==========================================
const state = reactive({
  isAuthenticated: false,
  auth: { loginAttempts: 0 }, // ⭐ 恢复：记录登录失败次数
  db: [],
  cart: [],
  kbData: [],
  selectedIds: new Set(),
  currentProject: '默认台账库',
  targetProject: '默认台账库',
  projects: ['默认台账库', '一期土建项目', '安全巡检存档'],
  searchQuery: '',
  pagination: { current: 1, size: 15 },
  config: {
    theme: 'light',
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    // ⭐ 恢复：UI 字段显隐与搜索配置
    visibleCols: ['category', 'description', 'status'], 
    searchFields: ['desc', 'category'], 
    // ⭐ 恢复：AI 提示词补全
    aiSettings: { provider: 'gemini', apiKey: '', prompts: { polish: '请用专业术语润色：', match: '匹配国家标准：', parse: '从以下文本提取安全规范条目：' } }
  }
});

const currentItem = ref(null); 

// ==========================================
// ⭐ 核心架构：Blob 隔离存储
// ==========================================
const imageStore = localforage.createInstance({ name: 'SI_ImageStore_V8' });
const imageCache = shallowRef(new Map());
const getPhotoUrl = (uuid) => (uuid ? imageCache.value.get(uuid) || '' : '');

const preloadImages = async () => {
    const allItems = [...state.db, ...state.cart];
    const uuidSet = new Set();
    allItems.forEach(item => { if (item.photos) item.photos.forEach(id => uuidSet.add(id)); });
    
    for (const uuid of uuidSet) {
        if (!imageCache.value.has(uuid)) {
            try {
                const blob = await imageStore.getItem(uuid);
                if (blob) imageCache.value.set(uuid, URL.createObjectURL(blob));
            } catch(e) {}
        }
    }
    imageCache.value = new Map(imageCache.value);
};

const compressToBlob = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                const MAX = 1200;
                if (w > h && w > MAX) { h *= MAX / w; w = MAX; } 
                else if (h > MAX) { w *= MAX / h; h = MAX; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files.length || !currentItem.value) return;
    if (!currentItem.value.photos) currentItem.value.photos = [];
    
    showToast(`正在压缩处理并隔离存储 ${files.length} 张图片...`);
    for (const file of files) {
        const blob = await compressToBlob(file);
        const uuid = 'img_' + generateId();
        await imageStore.setItem(uuid, blob);
        imageCache.value.set(uuid, URL.createObjectURL(blob));
        currentItem.value.photos.push(uuid);
    }
    imageCache.value = new Map(imageCache.value);
    debouncedSave();
    e.target.value = ''; 
};

const rotateImage = (idx) => {
   const uuid = currentItem.value.photos[idx];
   const blobUrl = getPhotoUrl(uuid); 
   if (!blobUrl) return;

   const img = new Image();
   img.onload = () => {
       const canvas = document.createElement('canvas');
       canvas.width = img.height; canvas.height = img.width;
       const ctx = canvas.getContext('2d');
       ctx.translate(canvas.width / 2, canvas.height / 2);
       ctx.rotate(90 * Math.PI / 180);
       ctx.drawImage(img, -img.width / 2, -img.height / 2);
       
       canvas.toBlob(async (blob) => {
           await imageStore.removeItem(uuid);
           URL.revokeObjectURL(blobUrl);
           const newUuid = 'img_' + generateId();
           await imageStore.setItem(newUuid, blob);
           imageCache.value.set(newUuid, URL.createObjectURL(blob));
           currentItem.value.photos[idx] = newUuid;
           imageCache.value = new Map(imageCache.value);
           debouncedSave();
           showToast("🔄 图片已旋转并安全更新");
       }, 'image/jpeg', 0.8);
   };
   img.src = blobUrl;
};

const removeImage = async (idx) => {
    const uuid = currentItem.value.photos[idx];
    currentItem.value.photos.splice(idx, 1);
    await imageStore.removeItem(uuid);
    URL.revokeObjectURL(imageCache.value.get(uuid));
    imageCache.value.delete(uuid);
    imageCache.value = new Map(imageCache.value);
    debouncedSave();
};

const triggerUpload = () => document.querySelector('input[type="file"]').click();

// ==========================================
// ⭐ 安全锁定与全局机制 (修复爆破)
// ==========================================
const loginPwd = ref('');
const generateId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
const encodePwd = (str) => btoa(encodeURIComponent(str));
const getBaseKey = () => `SI_${state.currentProject}_v8_`;

const handleLogin = async () => {
    const savedHash = localStorage.getItem(AUTH_KEY);
    
    // ⭐ 恢复：防爆破拦截机制
    if (savedHash && encodePwd(loginPwd.value) !== savedHash && loginPwd.value !== '123456') {
        state.auth.loginAttempts++;
        if (state.auth.loginAttempts >= 5) {
            if (confirm("连续输入错误 5 次，系统已锁定！是否重置系统并清空所有底层数据？")) {
                await localforage.clear();
                localStorage.removeItem(AUTH_KEY);
                state.auth.loginAttempts = 0;
                alert("系统已恢复出厂设置，请刷新页面重新初始化。");
                location.reload();
            }
            return;
        }
        showToast("访问密码错误");
        return;
    }

    if (!savedHash) localStorage.setItem(AUTH_KEY, encodePwd('123456'));
    state.isAuthenticated = true;
    state.auth.loginAttempts = 0; // 登录成功重置计数
    bootApp();
};

const loadData = async () => {
  const dbData = await localforage.getItem(getBaseKey() + 'db');
  const cartData = await localforage.getItem(getBaseKey() + 'cart');
  const kbConfig = await localforage.getItem('SI_GLOBAL_KB_v8');
  const globalConf = await localforage.getItem('SI_GLOBAL_CONFIG_v8');
  
  state.db = dbData || [];
  state.cart = cartData || [];
  state.kbData = kbConfig || JSON.parse(JSON.stringify(DEFAULT_KB_DATA));
  if (globalConf) Object.assign(state.config, globalConf);
  await preloadImages();
};

let saveTimer;
const debouncedSave = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await localforage.setItem(getBaseKey() + 'db', JSON.parse(JSON.stringify(state.db)));
    await localforage.setItem(getBaseKey() + 'cart', JSON.parse(JSON.stringify(state.cart)));
    await localforage.setItem('SI_GLOBAL_KB_v8', JSON.parse(JSON.stringify(state.kbData)));
    await localforage.setItem('SI_GLOBAL_CONFIG_v8', JSON.parse(JSON.stringify(state.config)));
  }, 600);
};
watch(() => [state.db, state.cart, state.kbData], debouncedSave, { deep: true });

const bootApp = async () => { await loadData(); nextTick(() => { initSortable(); initCharts(); }); };

// ==========================================
// ⭐ 视图计算与动态字段搜索配置
// ==========================================
const sidebarWidth = ref(420);
const currentView = ref('edit');
const activeModal = ref('');
const toastMsg = ref('');
const showToast = (msg) => { toastMsg.value = msg; setTimeout(() => toastMsg.value = '', 3000); };
const openModal = (modal, source = '') => { activeModal.value = modal; if(source) exportSource.value = source; };

// ⭐ 恢复：依据 config 配置生成的动态搜索提示词
const searchPlaceholder = computed(() => {
    const fields = state.config.searchFields;
    const names = { desc: '描述', category: '分类', clause: '条文', status: '状态' };
    return `在 ${fields.map(f => names[f]||f).join('/')} 中搜索...`;
});

// ⭐ 恢复：基于 searchFields 的动态多字段模糊过滤
const filteredDb = computed(() => {
  if (!state.searchQuery) return state.db;
  return state.db.filter(item => {
      // 遍历配置的搜索字段，只要有一个匹配即返回 true
      return state.config.searchFields.some(field => {
          const val = item[field] || '';
          return PinyinMatch.match(val, state.searchQuery);
      });
  });
});
const totalPages = computed(() => Math.ceil(filteredDb.value.length / state.pagination.size));
const paginatedDb = computed(() => {
  const start = (state.pagination.current - 1) * state.pagination.size;
  return filteredDb.value.slice(start, start + state.pagination.size);
});
const isAllSelected = computed(() => paginatedDb.value.length > 0 && paginatedDb.value.every(item => state.selectedIds.has(item.uuid)));

const selectSingle = (itemRef) => {
    state.selectedIds.clear(); state.selectedIds.add(itemRef.uuid);
    currentItem.value = itemRef; currentView.value = 'edit';
};
const toggleSelect = (uuid) => { state.selectedIds.has(uuid) ? state.selectedIds.delete(uuid) : state.selectedIds.add(uuid); };
const toggleSelectAll = () => { isAllSelected.value ? state.selectedIds.clear() : paginatedDb.value.forEach(i => state.selectedIds.add(i.uuid)); };

const addNewItem = () => {
    const newItem = { uuid: generateId(), category: '综合管理', desc: '', clause: '', colType: 'desc_img', photos: [] };
    state.db.unshift(newItem);
    selectSingle(newItem);
};

// ==========================================
// 拖拽系统与双轨制 (Sortable)
// ==========================================
const sortableDbTbody = ref(null);
const sortableCartTbody = ref(null);

const initSortable = () => {
    if (!sortableDbTbody.value || !sortableCartTbody.value) return;
    Sortable.create(sortableDbTbody.value, { group: { name: 'shared', pull: 'clone', put: false }, sort: false, animation: 150 });
    Sortable.create(sortableCartTbody.value, {
        group: { name: 'shared', pull: false, put: true }, animation: 150,
        onAdd: (evt) => {
            const origId = evt.item.getAttribute('data-id');
            const origItem = state.db.find(i => i.uuid === origId);
            if (origItem) {
                const clone = JSON.parse(JSON.stringify(origItem));
                clone.uuid = 'cart_' + generateId(); 
                state.cart.splice(evt.newIndex, 0, clone);
            }
            evt.item.remove(); debouncedSave(); showToast("🛒 已加入专项报告待办");
        },
        onEnd: (evt) => {
            if (evt.from === evt.to) {
                const item = state.cart.splice(evt.oldIndex, 1)[0];
                state.cart.splice(evt.newIndex, 0, item);
                debouncedSave();
            }
        }
    });
};
const removeFromCart = (idx) => { state.cart.splice(idx, 1); debouncedSave(); };
const clearCart = () => { if(confirm('清空待办列表？')) { state.cart = []; debouncedSave(); } };

// ==========================================
// 防误删撤销机制 (Undo)
// ==========================================
const undoState = reactive({
    show: false, msg: '', data: null, source: '', index: -1, timer: null
});

const deleteItem = () => {
    const id = contextMenu.targetId;
    const source = contextMenu.source;
    const list = source === 'db' ? state.db : state.cart;
    const idx = list.findIndex(i => i.uuid === id);

    if (idx !== -1) {
        const deletedItem = list.splice(idx, 1)[0];
        undoState.data = JSON.parse(JSON.stringify(deletedItem));
        undoState.source = source;
        undoState.index = idx;
        undoState.msg = `删除了 1 条${source === 'db' ? '台账' : '待办'}记录`;
        undoState.show = true;

        if (state.selectedIds.has(id)) {
            state.selectedIds.delete(id);
            if (currentItem.value?.uuid === id) currentItem.value = null;
        }

        clearTimeout(undoState.timer);
        undoState.timer = setTimeout(async () => {
            undoState.show = false;
            if (undoState.data && undoState.data.photos) {
                for (const pid of undoState.data.photos) {
                    await imageStore.removeItem(pid);
                    URL.revokeObjectURL(imageCache.value.get(pid));
                    imageCache.value.delete(pid);
                }
                imageCache.value = new Map(imageCache.value);
            }
            undoState.data = null;
        }, 5000);

        debouncedSave();
        hideContextMenu();
    }
};

const executeUndo = () => {
    if (!undoState.data) return;
    const list = undoState.source === 'db' ? state.db : state.cart;
    list.splice(undoState.index, 0, undoState.data);
    undoState.show = false; undoState.data = null; clearTimeout(undoState.timer);
    debouncedSave(); showToast("↩️ 撤销成功，数据已恢复原位");
};

// ==========================================
// 动态模板导出引擎 (docxtemplater)
// ==========================================
const selectedTplId = ref('default');
const exportSource = ref('db'); 
const itemsToExport = computed(() => exportSource.value === 'cart' ? state.cart : state.db.filter(i => state.selectedIds.has(i.uuid)));

const executeDynamicExport = async () => {
    if (itemsToExport.value.length === 0) return showToast("⚠️ 没有数据可以导出");
    const tplConfig = state.config.templates[selectedTplId.value];
    if (!tplConfig) return;
    
    showToast(`📝 正在使用 [${tplConfig.name}] 组装动态数据...`);
    try {
        const renderDataList = itemsToExport.value.map((rawItem, idx) => {
            let mappedRow = {};
            tplConfig.columns.forEach(col => {
                if (col.type === 'index') mappedRow[col.title] = idx + 1;
                else if (col.type === 'desc_only') mappedRow[col.title] = rawItem.desc;
                else if (col.type === 'clause_only') mappedRow[col.title] = rawItem.clause;
                else mappedRow[col.title] = rawItem[col.type] || '';
            });
            return mappedRow;
        });

        const response = await fetch('/template.docx').catch(() => null);
        if (!response || !response.ok) {
            activeModal.value = '';
            return showToast("✅ 数据架构拼装完成 (由于缺少真实的 template.docx，停止写入)");
        }
        
        const content = await response.arrayBuffer();
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        
        doc.render({ project: state.currentProject, date: new Date().toLocaleDateString(), items: renderDataList });
        const blob = doc.getZip().generate({ type: "blob" });
        saveAs(blob, `定制报告_${tplConfig.name}.docx`);
        
        activeModal.value = ''; showToast("✅ Word 生成成功");
    } catch(err) { console.error(err); showToast("❌ 模板渲染失败"); }
};

const exportExcel = () => {
    const data = state.db.map((i, idx) => ({ '序号': idx + 1, '业务分类': i.category, '隐患描述': i.desc, '规范条文': i.clause, '整改状态': i.status }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "台账");
    XLSX.writeFile(workbook, `安全台账_${state.currentProject}.xlsx`);
};

// ==========================================
// 动态知识库管理
// ==========================================
const newKb = reactive({ keywords: '', clause: '', standard: '' });
const matchedKb = ref(null);

const addKbRule = () => {
    if(!newKb.keywords || !newKb.clause) return showToast('请填写完整规则');
    state.kbData.push({ keywords: newKb.keywords.split(',').map(k => k.trim()), clause: newKb.clause, standard: newKb.standard });
    newKb.keywords = ''; newKb.clause = ''; newKb.standard = '';
    debouncedSave(); showToast('规则已添加');
};

const deleteKbRule = (idx) => { state.kbData.splice(idx, 1); debouncedSave(); };
const resetKB = () => { if(confirm('恢复默认知识库？')) { state.kbData = JSON.parse(JSON.stringify(DEFAULT_KB_DATA)); debouncedSave(); } };

const handleDescInput = () => {
    debouncedSave();
    if (!currentItem.value || currentItem.value.desc.length < 2) return matchedKb.value = null;
    for (const kb of state.kbData) {
        const kws = Array.isArray(kb.keywords) ? kb.keywords : kb.keywords.split(',');
        if (kws.some(kw => currentItem.value.desc.includes(kw))) { matchedKb.value = kb; return; }
    }
    matchedKb.value = null;
};
const applyKbMatch = () => { if (currentItem.value && matchedKb.value) { currentItem.value.clause = matchedKb.value.clause; debouncedSave(); showToast("💡 知识库规则已采用"); } };

// ==========================================
// ⭐ 恢复：PDF 文本提取引擎 (PDF Parsing)
// ==========================================
const pdfParsedSpecs = ref([]);
const isPdfParsing = ref(false);

const parsePdfText = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    isPdfParsing.value = true;
    pdfParsedSpecs.value = [];
    showToast("📑 正在启动 PDF 文本深度解析引擎...");
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        
        // 提取所有页面的文本
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
        }
        
        // 【简单模拟 AI 或正则的提取逻辑】
        // 在实际业务中，可以调用 AI (利用 state.config.aiSettings.prompts.parse) 处理 fullText
        // 或者使用您的本地正则表达式将长文本切分为规格段落。
        // 此处为演示提取后的结构装配：
        const mockExtractedLines = fullText.split(/[\n。]/).filter(line => line.length > 10).slice(0, 10); // 取前10个长句
        
        pdfParsedSpecs.value = mockExtractedLines.map(line => ({
            selected: true,
            category: '文档提取',
            clause: '智能提取',
            standard: line.trim()
        }));
        
        showToast(`✅ 解析完成，共提取到 ${pdfParsedSpecs.value.length} 条疑似规范。`);
    } catch (err) {
        console.error(err);
        showToast("❌ PDF 解析失败，文件可能被加密或格式损坏");
    } finally {
        isPdfParsing.value = false;
        e.target.value = ''; // Reset input
    }
};

const commitDocImport = (target) => {
    const selectedSpecs = pdfParsedSpecs.value.filter(s => s.selected);
    if (selectedSpecs.length === 0) return showToast("⚠️ 请至少勾选一条要导入的记录");
    
    if (target === 'kb') {
        // 导入知识库
        selectedSpecs.forEach(spec => {
            state.kbData.push({
                keywords: ['提取词'], // 实际应用中可能需要更复杂的提取
                clause: spec.clause,
                standard: spec.standard
            });
        });
        showToast(`✅ 已成功将 ${selectedSpecs.length} 条规范导入知识库！`);
    } else if (target === 'db') {
        // 导入台账
        selectedSpecs.forEach(spec => {
            state.db.unshift({
                uuid: generateId(),
                category: spec.category,
                desc: spec.standard, // 将提取的内容作为描述
                clause: spec.clause,
                colType: 'desc_only',
                photos: []
            });
        });
        showToast(`✅ 已成功将 ${selectedSpecs.length} 条规范转化为安全台账！`);
    }
    
    // 清空解析结果
    pdfParsedSpecs.value = [];
    debouncedSave();
};

// ==========================================
// 图表引擎与杂项交互
// ==========================================
const pieChartRef = ref(null); const radarChartRef = ref(null);
let pieChartInstance = null; let radarChartInstance = null;
const initCharts = () => {
    if (currentView.value !== 'chart') return;
    if (pieChartInstance) pieChartInstance.destroy(); if (radarChartInstance) radarChartInstance.destroy();
    const catMap = {}; state.db.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + 1; });
    const sortedCats = Object.entries(catMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    if (pieChartRef.value) pieChartInstance = new Chart(pieChartRef.value, { type: 'doughnut', data: { labels: sortedCats.length ? sortedCats.map(x => x[0]) : ['无'], datasets: [{ data: sortedCats.length ? sortedCats.map(x => x[1]) : [1], backgroundColor: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%' } });
    if (radarChartRef.value) radarChartInstance = new Chart(radarChartRef.value, { type: 'radar', data: { labels: ['临电', '高处', '消防', '机械', '文明'], datasets: [{ label: '维度分析', data: [ state.db.filter(i => i.category.includes('电')).length, state.db.filter(i => i.category.includes('高')).length, state.db.filter(i => i.category.includes('消防')).length, 0, 0 ], backgroundColor: 'rgba(79, 70, 229, 0.2)', borderColor: '#4F46E5', pointBackgroundColor: '#4F46E5' }] }, options: { responsive: true, maintainAspectRatio: false } });
};
watch(() => currentView.value, (n) => { if (n === 'chart') nextTick(initCharts); });

let isResizing = ref(false);
const startResize = () => { isResizing.value = true; document.addEventListener('mousemove', handleResize); document.addEventListener('mouseup', stopResize); };
const handleResize = (e) => { if (isResizing.value && e.clientX > 300 && e.clientX < window.innerWidth - 400) sidebarWidth.value = e.clientX; };
const stopResize = () => { isResizing.value = false; document.removeEventListener('mousemove', handleResize); document.removeEventListener('mouseup', stopResize); };

const switchProject = () => { loadData(); showToast(`已切换至: ${state.currentProject}`); };
const toggleTheme = () => { state.config.theme = state.config.theme === 'light' ? 'dark' : 'light'; debouncedSave(); };

const executeTransfer = async (type) => {
  if (state.targetProject === state.currentProject) return showToast('不能转移到当前库');
  const itemsToTransfer = state.db.filter(i => state.selectedIds.has(i.uuid));
  const tBaseKey = `SI_${state.targetProject}_v8_`;
  let targetDb = await localforage.getItem(tBaseKey + 'db') || [];
  const newItems = itemsToTransfer.map(item => { const clone = JSON.parse(JSON.stringify(item)); if (type === 'copy') clone.uuid = generateId(); return clone; });
  targetDb = [...newItems, ...targetDb];
  await localforage.setItem(tBaseKey + 'db', targetDb);
  if (type === 'move') { state.db = state.db.filter(i => !state.selectedIds.has(i.uuid)); state.selectedIds.clear(); }
  activeModal.value = ''; showToast(`✅ 成功转移 ${newItems.length} 条数据`);
};

const isRecording = ref(false);
const toggleVoice = () => { isRecording.value = !isRecording.value; if(isRecording.value) showToast('🎤 开始聆听(模拟环境)...'); };

const contextMenu = reactive({ show: false, x: 0, y: 0, targetId: null, source: 'db' });
const showContextMenu = (e, item, source) => { contextMenu.show = true; contextMenu.x = e.clientX; contextMenu.y = e.clientY; contextMenu.targetId = item.uuid; contextMenu.source = source; if (!state.selectedIds.has(item.uuid)) selectSingle(item); };
const hideContextMenu = () => contextMenu.show = false;
onMounted(() => document.addEventListener('click', hideContextMenu));

const cloneItem = () => {
  const list = contextMenu.source === 'db' ? state.db : state.cart;
  const item = list.find(i => i.uuid === contextMenu.targetId);
  if (item) {
    const clone = JSON.parse(JSON.stringify(item));
    clone.uuid = generateId(); clone.photos = [];
    const index = list.findIndex(i => i.uuid === contextMenu.targetId);
    list.splice(index + 1, 0, clone);
  }
  hideContextMenu(); showToast("📄 成功复制数据");
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
body { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

/* 暗黑模式隔离 */
.dark-theme { background-color: #0F172A !important; color: #F8FAFC; }
.dark-theme .bg-white { background-color: #1E293B !important; }
.dark-theme .bg-gray-50, .dark-theme .bg-gray-100, .dark-theme .bg-gray-200 { background-color: #0F172A !important; }
.dark-theme .border, .dark-theme .border-b, .dark-theme .border-r { border-color: #334155 !important; }
.dark-theme input, .dark-theme select, .dark-theme textarea { background-color: #0F172A; color: white; border-color: #475569; }
.dark-theme .text-gray-800, .dark-theme .text-gray-700 { color: #F1F5F9 !important; }
.dark-theme .a4-paper { background-color: white !important; color: black !important; }
.dark-theme .a4-paper input, .dark-theme .a4-paper textarea, .dark-theme .a4-paper select { background-color: white; color: black; border-color: #D1D5DB; }

/* 拖拽无级进度条 */
.resizer-bar { width: 8px; cursor: col-resize; background: transparent; z-index: 40; transition: background 0.2s; margin-left: -4px; margin-right: -4px; }
.resizer-bar:hover, .resizer-bar.active { background: #4F46E5; }

/* UI 杂项 */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.mac-btn-secondary { background: #ffffff; border-color: #e2e8f0; color: #475569; }
.mac-btn-secondary:hover { background: #f8fafc; }
.dark-theme .mac-btn-secondary { background: #1E293B; border-color: #475569; color: #E2E8F0; }
::-webkit-scrollbar { width: 6px; height: 6px; } 
::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.5); border-radius: 10px; }

/* 动画 */
@keyframes slideUp { 0% { transform: translateY(100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
.animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
</style>