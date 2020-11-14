var map = {};
var overlay = [];
var hits = {
    province: '省份',
    city: '城市',
    district: '区县',
    biz_area: '商圈',
};

var currentType;

/**
 * 坐标转换
 * @param {array} coord2DStr 数据区块
 */
function coord2DStrToLngLatsCore(coord2DStr) {
    if (!coord2DStr) {
        return;
    }
    var coord2DArr = coord2DStr.split(/;|,/);
    var lngLat = null,
        lngLats = [];
    var lng = 0,
        lat = 0;
    for (var i = 0; i < coord2DArr.length; i = i + 2) {
        lng = coord2DArr[i];
        lat = coord2DArr[i + 1];
        if (!lng || !lat || isNaN(lng) || isNaN(lat)) {
            // 不能为空值，不能为0，必须是数字
            break;
        }
        lngLat = new AMap.LngLat(lng, lat);
        lngLats.push(lngLat);
    }
    return lngLats;
}

/**
 * 坐标转换
 * @param {array} coord2DStr 数据区块
 */
function coord2DStrToLngLats(coord2DStr) {
    if (!coord2DStr) {
        return;
    }

    var arr = coord2DStr.split('|');
    var lngLats = [];
    for (var i = 0; i < arr.length; i++) {
        lngLats.push(coord2DStrToLngLatsCore(arr[i]));
    }

    if (arr.length == 1) {
        lngLats = lngLats[0];
    }

    return lngLats;
}

/**
 * 绘制一个区域
 * @param {array} lngLats 经纬坐标
 * @param {string} color 颜色
 */
function drawArea(lngLats, color) {
    var polygon = new AMap.Polygon({
        path: lngLats, // 设置多边形边界路径
        strokeColor: color, // "#2C64B0", // 线颜色
        strokeOpacity: 0, // 线透明度
        strokeWeight: 0, // 线宽
        fillColor: color, // "#2C64B0", // 填充色
        fillOpacity: 0.3, // 填充透明度
    });
    polygon.setMap(map);
    return polygon;
}

/**
 * 初始化地图
 */
function initMap() {
    map = new AMap.Map('serviceAreaMapContainer', {
        center: [107.05191814999961, 38.69095289361865],
        zoom: 4,
        resizeEnable: true,
        mapStyle: 'blue_night',
    });

    var geolocation = new AMap.Geolocation({
        timeout: 10000, // 超过10秒后停止定位，默认：无穷大
        showButton: false, // 显示定位按钮，默认：true
        panToLocation: false, // 定位成功后将定位到的位置作为地图中心点，默认：true
    });
    // 地图上显示当前位置的点
    geolocation.getCurrentPosition();
    map.addControl(geolocation);

    map.addControl(new AMap.ToolBar({ visible: true }));
    map.on('complete', showData);
}

/**
 * 清空地图上的覆盖物
 * @param {*} selectId
 */
function clearMap() {
    map.remove(overlay);
    overlay = [];
}

/**
 * 往地图上添加覆盖物
 */
function addPolygon(boundaries) {
    if (!boundaries) {
        return;
    }
    for (var i = 0; i < boundaries.length; i++) {
        // 生成行政区划polygon
        overlay.push(
            new AMap.Polygon({
                strokeWeight: 3,
                strokeColor: '#CCF3FF',
                strokeOpacity: 0.4, // 线透明度
                fillColor: '#CCF3FF',
                fillOpacity: 0,
                map: map,
                path: boundaries[i],
            })
        );
    }
}

/**
 * 生成下拉列表
 * @param {*} selectId
 * @param {*} list
 */
function createSelectList(selectId, list) {
    var selectList = document.getElementById(selectId);
    selectList.innerHTML = '';
    if (list.length !== 1) { // 只有一个选项时，默认选中
        selectList.add(new Option('请选择' + hits[selectId]));
    }
    for (var i = 0; i < list.length; i++) {
        var option = new Option(list[i].name);
        option.setAttribute('value', list[i].adcode);
        option.center = list[i].center; // TODO: 人为定义元素到 dom 节点上
        selectList.add(option);
    }
    if (list.length === 1) { // 只有一个选项时，默认选中，下一级选项初始化
        $('#' + selectId).change();
    }
}

/**
 * 查询行政区划列表并生成相应的下拉列表
 * @param {*} adcodeLevel
 * @param {*} keyword
 * @param {*} selectId
 */
function search(adcodeLevel, keyword, selectId) {
    if (keyword.indexOf('选择') !== -1) {
        clearMap();
        return;
    }
    var district = new AMap.DistrictSearch({
        // 高德行政区划查询插件实例
        subdistrict: 1, // 返回下一级行政区
    });
    // 第三级时查询边界点，不显示边界
    district.setExtensions(adcodeLevel == 'district' || adcodeLevel == 'city' || adcodeLevel == 'province' ? 'all' : 'base');
    district.setLevel(adcodeLevel); // 行政区级别
    district.search(keyword, function (status, result) {
        // 注意，api返回的格式不统一，在下面用三个条件分别处理
        if (result && result.districtList && result.districtList.length) {
            var districtData = result.districtList[0];
            map.setCenter(districtData.center);
            clearMap();
            addPolygon(districtData.boundaries);

            if (selectId) {
                if (districtData.districtList) {
                    createSelectList(selectId, districtData.districtList);
                } else if (districtData.districts) {
                    createSelectList(selectId, districtData.districts);
                } else {
                    clear(selectId);
                }
            }
        } else {
            clearMap();
        }
    });
}

/**
 * 外部参数
 */
function getUrlParam(url) {
    let list = (url || location.search).substring(1).split('&');
    let params = {};
    for (var i = 0; i < list.length; i++) {
        var item = list[i].split('=');
        params[decodeURIComponent(item[0])] = decodeURIComponent(item[1]);
    }
    return params;
}

/**
 * 初始化省市区搜索下拉框
 */
function initAutoComplete() {
    var autocomplete = new AMap.Autocomplete({ city: '', input: 'search' });
    AMap.event.addListener(autocomplete, 'select', function (e) {
        document.getElementById('search_district').value = e.poi.district;
        if (e.poi.location) {
            search('district', e.poi.adcode);
        } else {
            search('province', e.poi.name);
        }
        map.setZoomAndCenter(12);
    });
}

/**
 * 显示地区区域
 */
function showData() {
    // 省市区数据初始化
    search('country', '中国', 'province');
    initAutoComplete();

    // 如果其他系统带过来的经纬度
    var queryParams = getUrlParam();
    if (queryParams.lng && queryParams.lat) {
        document.getElementById('TxtLng').value = decodeURIComponent(queryParams.lng);
        document.getElementById('TxtLat').value = decodeURIComponent(queryParams.lat);
        $('#typeBar').find('.lng-lat').click();
        searchLocal();
    }
}

function clear(selectId) {
    document.getElementById(selectId).innerHTML = '<option>请选择' + hits[selectId] + '</option>';
}

/**
 * 经纬度转换
 * @param {*} value
 */
function convert2Du(value) {
    var parts = (value || '').split(/[^\d\.\w]/);
    var degrees = +parts[0] || 0;
    var minutes = +parts[1] || 0;
    var seconds = +parts[2] || 0;
    var dd = degrees + (minutes / 60) + (seconds / 3600);
    if (parts[3] === 'S' || parts[3] === 'W') {
        dd *= -1;
    }
    return dd;
}

/**
 * 往地图上添加覆盖物
 */
function addMarker(obj) {
    if (!obj) {
        return;
    }
    return new AMap.Marker({
        map: map,
        position: new AMap.LngLat(obj.lon || obj.lng, obj.lat),
        zIndex: 300,
    });
}

/**
 * 根据经纬度查找
 */
function searchLocal() {
    var lng = convert2Du(document.getElementById('TxtLng').value);
    var lat = convert2Du(document.getElementById('TxtLat').value);

    if (!lng || !lat) {
        alert('请输入经纬度');
        return;
    }
    // 清除历史记录
    clearMap();
    // 定位
    var marker = addMarker({ lng: lng, lat: lat });
    if (marker) {
        overlay.push(marker);
        map.setCenter([lng, lat]);
        map.setZoomAndCenter(9);
    }
}

/**
 * 添加省市区联动事件
 */
function addEvents() {
    currentType = $('#typeBar').find('input:checked').val();
    $('#typeBar').click(function (event) {
        if (event.target.tagName === 'INPUT') {
            var newType = $(this).find('input:checked').val();
            if ($('#toolbarContainer').hasClass('up') || newType !== currentType) {
                $('#toolbarContainer').removeClass('up');
                $(newType).removeClass('hidden').siblings('.tool').addClass('hidden');
                currentType = newType;
            } else {
                $('#toolbarContainer').addClass('up');
            }
        }
    });
    $('#province').change(function () {
        search('province', this.value, 'city');
        clear('district');
        clear('biz_area');
        // 6: 省，9: 市，12: 区，10: 按照经纬度定位
        map.setZoomAndCenter(6);
    });
    $('#city').change(function () {
        search('city', this.value, 'district');
        clear('biz_area');
        map.setZoomAndCenter(9);
    });
    $('#district').change(function () {
        search('district', this.value, 'biz_area');
        map.setZoomAndCenter(12);
    });
    $('#biz_area').change(function () {
        map.setCenter(this[this.options.selectedIndex].center);
    });
    $('#locatorBtnOk').click(searchLocal);
}

initMap();
addEvents();
