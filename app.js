var map = {};
var overlay = [];
var hits = {
    province: '省份',
    city: '城市',
    district: '区县',
    biz_area: '商圈',
    site: '学校',
};

var currentType;
var currentLevel;

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
 * https://lbs.amap.com/api/javascript-api/guide/map/map-style/
 * 官方默认自定义样式 标准 normal, 幻影黑 dark, 月光银 light, 远山黛 whitesmoke, 草色青 fresh, 雅士灰 grey, 涂鸦 graffiti, 马卡龙 macaron, 靛青蓝 blue, 极夜蓝 darkblue, 酱籽 wine
 */
function initMap() {
    map = new AMap.Map('serviceAreaMapContainer', {
        center: [107.05191814999961, 38.69095289361865],
        zoom: 4,
        resizeEnable: true,
        mapStyle: 'normal', // https://lbs.amap.com/getting-started/mapstyle
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
    map.clearMap();
    currentLevel = keyword;
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

            // 只有选中市时，才搜索学校
            // if (['city', 'province', 'district'].indexOf(adcodeLevel) > -1) {
                searchSite(districtData.adcode);
            // }

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
            console.error(status + ': ' + result.message);
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
 * 当前位置
 */
function currentLocate() {
    var current = document.getElementById('current');
    if (current.location) {
        return;
    }
    new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000, // 超过10秒后停止定位，默认：无穷大
        showButton: false, // 显示定位按钮，默认：true
        panToLocation: true, // 定位成功后将定位到的位置作为地图中心点，默认：true
        zoomToAccuracy: true,
    }).getCurrentPosition(function (status, result) {
        // map.setCenter(result.position);
        // map.setZoomAndCenter(18);
        addMarker(result.position);
        var address = result.addressComponent;
        if (address) {
            current.innerHTML =
                address.province +
                address.city +
                address.district +
                address.township +
                address.street +
                address.streetNumber;
            current.position = result.position;
            // 规划路径
            setRoute();
            // 清空之前的定位错误提示
            if (document.getElementById('mainError').innerHTML.indexOf('定位') > -1) {
                mainError();
            }
        } else {
            mainError('定位失败，请稍后重试');
            setTimeout(currentLocate, 60 * 1000);
            console.error(status + ': ' + result.message);
        }
    });
}

/**
 * 全局错误提示
 */
function mainError(msg) {
    document.getElementById('mainError').innerHTML = msg || '';
}

/**
 * 路径规划 TODO: 选择学校候进行
 */
function setRoute() {
}

/**
 * 显示地区区域
 */
function showData() {
    // 省市区数据初始化
    search('country', '中国', 'province');
    initAutoComplete();
    currentLocate();

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
 * 搜索学校
 * PlaceSearch 接口 https://lbs.amap.com/api/javascript-api/reference/search/#m_AMap.PlaceSearch
 * POI分类编码 https://lbs.amap.com/api/webservice/download
 */
function searchSite(adcode, type) {
    // 郊区、市区，是虚拟的直辖市下属市，忽略
    if (!adcode || adcode === '100000' || adcode.endsWith('0100') || adcode.endsWith('0200')) {
        // 没有选中省份时，不能调用学校
        return;
    }
    clear('site');
    map.clearMap();
    type = type || $('#serviceAreaBtnContainer input:checked').val() || 141200;
    new AMap.PlaceSearch({
        type: type,
        types: type,
        limit: true,
        citylimit: true,
        city: adcode,
        map: map,
    }).search('学校', function (status, result) {
        if (result && result.poiList && result.poiList.pois) {
            var list = [];
            // 过滤列表中无图片学校
            for (var i = 0; i < result.poiList.pois.length; i++) {
                if (result.poiList.pois[i].photos.length) {
                    list.push(result.poiList.pois[i]);
                }
            }
            clearMap();
            createSelectList('site', list);
            // setView();
        } else {
            console.error(status + ': ' + result.message);
        }
    });
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
        var value = this.value;
        if (!value || value.endsWith('100')) {
            // value = $('#province').val();
        }
        search('city', value, 'district');
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
    $('#serviceAreaBtnContainer input').click(function () {
        searchSite(currentLevel);
    });
    $('#locatorBtnOk').click(searchLocal);
}

initMap();
addEvents();
