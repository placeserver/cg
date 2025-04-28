const beforeSend = function(xmlHttpRequest){
    xmlHttpRequest.setRequestHeader("authCheck", true);
};



$(function() {

	let common = {
		isEmpty: (str) => {
			if(
				str == null ||
				(typeof str == 'string' && str.trim() == '') ||
				(typeof str == 'object' && Object.keys(str).length == 0) ||
				(Array.isArray(str) && str.length == 0)
			) {
				return true;
			}

			return false;
		},
		dots: (input, len) => {
			if(input.length >= len) return input.substr(0, len)+"...";
			return input;
		},
		getMessage: (code) => {
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				url : '/message',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					code:code
				}),
				success: function(data) {
					let message = data?.result?.message;
					deferred.resolve(message);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
			return deferred.promise();
		},
		datePickerBind: () => {
			$('.js-popup-schedule').off('showpopup').on('showpopup', function(popup, target){
				let p_select = $(target).attr('p-select');

				popup.find('[p-bind="date-input-btn"]').off('click');
				popup.find('[p-bind="date-input-btn"]').on('click', function() {

					var
					  popup 	= $(this).closest('.popup')
					, date 	= popup.find('[p-select="date-input"]').val()
					, time = popup.find('[p-select="time-input"]').text()
					;

					$(target).val(moment(date+' '+time).format('YYYY-MM-DD HH:mm'));
					hidePopup(popup);
				});
			});
		},
		setTagify: (people, selector) => {
			let inputElm = document.querySelector(selector);

			function tagTemplate(tagData){
				return `
					<tag title="${tagData.email}"
							contenteditable='false'
							spellcheck='false'
							tabIndex="-1"
							class="tagify__tag ${tagData.class ? tagData.class : ""}"
							${this.getAttributes(tagData)}>
						<x title='' class='tagify__tag__removeBtn' role='button' aria-label='remove tag'></x>
						<div>
							<div class='tagify__tag__avatar-wrap'>
							</div>
							<span class='tagify__tag-text'>${tagData.name}</span>
						</div>
					</tag>
				`
			}

			function suggestionItemTemplate(tagData){
				return `
					<div ${this.getAttributes(tagData)}
						class='tagify__dropdown__item ${tagData.class ? tagData.class : ""}'
						tabindex="0"
						role="option">
						${ tagData.avatar ? `
						<div class='tagify__dropdown__item__avatar-wrap'>
						</div>` : ''
						}
						<strong>${tagData.name}</strong>
						<span>${tagData.id}</span>
					</div>
				`
			}

			function dropdownHeaderTemplate(suggestions){
				return `
					<div class="${this.settings.classNames.dropdownItem} ${this.settings.classNames.dropdownItem}__addAll">
						<strong p-value="addAll"></strong>
						<span>${_spl('peopleUnit', {message1:suggestions.length})}</span>
					</div>
				`
			}
			let whitelist = [];
			for(let i of people) {
				whitelist.push({
					"value" : i.ucode,
					"name" : i.name,
					"id" : i.id
				});
			}

			let uuid = common.makeRandomCode(30);

			if(inputElm.tagify != null) {
				inputElm.tagify.removeAllTags();
				inputElm.tagify.destroy();
			}


			$(inputElm).attr('uuid', uuid);

			inputElm.tagify = new Tagify(inputElm, {
				tagTextProp: selector,
				enforceWhitelist: true,
				skipInvalid: true,
				userInput: false,
				dropdown: {
					closeOnSelect: false,
					enabled: 0,
					classname: uuid,
					uuid: uuid,
					searchKeys: ['name', 'email']
				},
				templates: {
					tag: tagTemplate,
					dropdownItem: suggestionItemTemplate,
					dropdownHeader: dropdownHeaderTemplate
				},
				whitelist: whitelist
			})

			inputElm.tagify.on('dropdown:select', onSelectSuggestion)

			function onSelectSuggestion(e){
				let uuid = $(e.detail.elm).closest('[tag-uuid]').attr('tag-uuid');
				let input = $(`[uuid=${uuid}]`)[0];
				let tagify = input.tagify;

				if( e.detail.elm.classList.contains(`${tagify.settings.classNames.dropdownItem}__addAll`) ) tagify.dropdown.selectAll();
			}
		},
		makeRandomCode: (length, type) => {
			let result = '';
			let charactersStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
			let charactersNum = '0123456789';
			let characters = '';


			if (type == 'num') {
				characters = charactersNum;
			} else if (type == 'str') {
				characters = charactersStr;
			} else {
				characters = charactersStr + charactersNum;
			}

			let charactersLength = characters.length;
			for (let i = 0; i < length; i++) {
				let key = characters.charAt(Math.floor(Math.random() * charactersLength));

				if (key == '0' && i == 0) {
					while (true) {
						key = characters.charAt(Math.floor(Math.random() * charactersLength));
						if (key != '0') break;
					}
				}

				result += key;
			}
			return result;
		}
	}

	window.fileShareInit = {
		init: () => {
			$('[p-select="file-share-upload"]').on('change', function(e){


				let file = $(this)[0].files;
				$('.popup__loading').addClass('show');
				const formData = new FormData();

				for(let i=0; i<file.length; i++){
					formData.append('convert_share_file', file[i]);
					formData.append('ccode', confCode);
				}

				$.ajax({
					beforeSend: beforeSend,
					type: 'POST',
					url: '/files/share/upload',
					processData: false,
					contentType: false,
					data: formData,
					// PROGRESS DOCS
					xhr: function() {
						var xhr = new window.XMLHttpRequest();
					   xhr.upload.addEventListener("progress", function(evt) {
							if (evt.lengthComputable) {
								var percentComplete = evt.loaded / evt.total * 100;
								document.getElementById('uploadProgressShare').textContent = percentComplete.toFixed(1) + '%';
							}
						}, false);
						return xhr;
					},
				   // PROGRESS END
					success: function(data) {
						$('.popup__loading').removeClass('show');
						fileShareInit.getShareFileList();
					},
					error: function(e) {
						$('.popup__loading').removeClass('show');
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
						}
					}
				});
			});

			$('.js-popup-file-share').on('showpopup', function() {
				fileShareInit.getShareFileList();
			});

			fileShareInit.getShareFileList();
		},

		getShareFileList: () => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/files/share/list',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					confCode: confCode
				}),
				success: function(data) {
					const result = data.result;
					$('[p-select="file-share-item"]').remove();

					for(let i of result){
						let date = moment(i.create_at).format('YY-MM-DD');
						let tag = `	<div class="transactions__row participant-item" p-select="file-share-item" p-fcode="${i.fcode}">
				                        <div class="transactions__col">${i.originalname}</div>
				                        <div class="transactions__col">${i.name}</div>
				                        <div class="transactions__col">${date}</div>
				                        <div class="transactions__col file__delete">
				                        	${i.ucode == currUcode ? `<button class="button-small red" p-select="file-share-delete" p-fcode="${i.fcode}">삭제</button>`:''}
				                        </div>
				                    </div>`;
				        $('[p-select="file-share-list"]').append(tag);
					}

					
					$('[p-select="file-share-item"]').off('click').on('click', function(e){
						if($(e.target).attr('p-select') != 'file-share-delete') {
							var fcode = $(this).attr('p-fcode');
			                var aTag = $(`<a href='/files/share/download?fcode=${fcode}' target='_blank'></a>`).appendTo('body');
			                aTag[0].click();
			                aTag.remove();
						}
					});

					$('[p-select="file-share-delete"]').off('click').on('click', function(e){
						if($(e.currentTarget).attr('p-select') == 'file-share-delete') {
							const fcode = $(this).attr('p-fcode');
							fileShareInit.removeFileShare(fcode);
						}
					});

					if(result.length >= 1){
						$('#fileShare').css({'background-color' : `#19ce60`});
						$('#fileShare svg').css({'fill' : 'white'});
						$('#fileShare span').css({'color' : 'white'});
					} else if (result.length <= 0){
						$('#fileShare').css('background-color', '');
						$('#fileShare svg').css({'fill' : ''});
						$('#fileShare span').css({'color' : ''});
					}

				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},

		removeFileShare: async (fcode) => {
			let confirm = await customConfirm('1094');
			
		    if(confirm == true) {
		    	$.ajax({
		    		beforeSend: beforeSend,
		    		url : '/files/share/delete',
		    		type : 'POST',
		    		contentType: 'application/json; charset=utf-8',
		    		data: JSON.stringify({
		    			confCode: confCode,
		    			fcode: fcode
		    		}),
		    		success: function(data) {
		    			fileShareInit.getShareFileList();
		    		},
		    		error: function(e) {
		    			if(e?.responseJSON?.errorCode == 'auth_failed') {
		    				customAlert('1098');
		    				parent.location.href = '/';
		    			}
		    			let message = e?.responseJSON?.message;
		    			if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
		    			else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							return alert(message);
		    				// window.loc = true;
		    				// return location.href='/';
		    			}
		    		}
		    	});
		    }
		}
	}

	window.defaultInit = {
		listCheckStream: [],
		scrollSetTimeout: null,
		endCheck: false,
		turnConfig: {
			iceServers: [
		        {
		            urls: [
		                'stun:stun.l.google.com:19302',
		                'stun:stun1.l.google.com:19302',
		                'stun:stun2.l.google.com:19302',
		                'stun:stun3.l.google.com:19302',
		                'stun:stun4.l.google.com:19302',
		            ]
		        },{
		            urls: 'turn:numb.viagenie.ca',
		            credential: 'muazkh',
		            username: 'webrtc@live.com',
		        },{
		            urls: 'turn:numb.viagenie.ca',
		            credential: 'muazkh',
		            username: 'webrtc@live.com',
		        },{
		            urls: 'turn:192.158.29.39:3478?transport=udp',
		            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
		            username: '28224511:1379330808',
		        }
		    ]
		},
		init: () => {
			$(document).on('keyup.fullscreen', function(e){
				if(e.keyCode == 122 && e.ctrlKey == true) {
					if($('body').hasClass('fv')) {
						$('svg[p-select="fullscreen"]').trigger('click');
					}else{
						$('button[p-select="fullscreen"]').trigger('click');
					}
				}
			});

			$('[p-select="panel-arrow"]').on('click', function(){
				const card = $(this).parent().next('.card');

				if(card.hasClass('hide')) {
					$(this).removeClass('hide');
					card.removeClass('hide')
				}else{
					$(this).addClass('hide');
					card.addClass('hide')
				}
			});

			$('[p-select="document-sort-save"]').on('click', function(){
				documentInit.turnSave();
				customAlert('2063');
			});

			$('[p-select="document-sort-name"], [p-select="document-sort-date"]').on('click', function(){
				const items = $('.js-popup-document .customer__table .customer__row.document__item').get();
				let selector = '[p-select="document-item-name"]';
				let type = 'name';

				if($(this).attr('p-select') == 'document-sort-date') {
					selector = '[p-select="document-item-date"]';
					type = 'date';
				}

				if($(this).attr('p-sort') == 'reverse') {
					$(this).removeAttr('p-sort');

					items.sort(function(a,b){
					  	let keyA = $(a).find(selector).text().trim();
						let keyB = $(b).find(selector).text().trim();

					  	if (keyB > keyA) return 1;
					  	if (keyA > keyB) return -1;
					  	return 0;
					});
				}else{
					$(this).attr('p-sort', 'reverse');

					items.sort(function(a,b){
					  	let keyA = $(a).find(selector).text().trim();
						let keyB = $(b).find(selector).text().trim();

					  	if (keyB > keyA) return -1;
					  	if (keyA > keyB) return 1;
					  	return 0;
					});
				}

				let ul = $('.js-popup-document .customer__table');

				$.each(items, function(i, li){
					ul.append(li);
				});

				//documentInit.turnSave();
			});


			$('.fv__utils').on('mouseenter', function() {
				$(this).addClass('on');
			});

			$('.fv__utils').on('mouseleave', function() {
				$(this).removeClass('on');
			});

			$('[p-select="fullscreen"]').on('click', function(){
				const fullscreenState = !$('body').hasClass('fv');

				if(permissionDoc.indexOf(currUcode) > -1){
					socketInit.io.emit('requestFullscreen', {confCode: confCode, fullscreen : fullscreenState})
					
					$('#viewerContainer').data('removeScroll', 'only');
					defaultInit.toggleFullScreen();
					$('.main__menu.side__menu.active').removeClass('active');
					PDFViewerApplication.pdfSidebar.close();
					$('[p-select="setting-panel"]').removeClass('active visible');
					toggleFullScreen();
					setTimeout(function() {
						$('#viewerContainer').removeData('removeScroll');
					}, 500)
				} else {
					$('#viewerContainer').data('removeScroll', 'only');
					defaultInit.toggleFullScreen();
					$('.main__menu.side__menu.active').removeClass('active');
					PDFViewerApplication.pdfSidebar.close();
					$('[p-select="setting-panel"]').removeClass('active visible');
					toggleFullScreen();
					setTimeout(function() {
						$('#viewerContainer').removeData('removeScroll');
					}, 500)
				}
			}); 
			
			$(window).on('keypress', function(e){
				if(e.keyCode == 43){
					if(permissionDoc.indexOf(currUcode) > -1){
						socketInit.io.emit('requestFullscreen', {confCode: confCode, fullscreen : true})
						
						$('#viewerContainer').data('removeScroll', 'only');
						defaultInit.toggleFullScreen();
						$('.main__menu.side__menu.active').removeClass('active');
						PDFViewerApplication.pdfSidebar.close();
						$('[p-select="setting-panel"]').removeClass('active visible');
						toggleFullScreen();
						setTimeout(function() {
							$('#viewerContainer').removeData('removeScroll');
						}, 500)
					} else {
						$('#viewerContainer').data('removeScroll', 'only');
						defaultInit.toggleFullScreen();
						$('.main__menu.side__menu.active').removeClass('active');
						PDFViewerApplication.pdfSidebar.close();
						$('[p-select="setting-panel"]').removeClass('active visible');
						toggleFullScreen();
						setTimeout(function() {
							$('#viewerContainer').removeData('removeScroll');
						}, 500)
					}
				}
			});

			$('[p-select="fv-btn-sync"]').on('click', function() {
				$('[p-select="btn-user-sync"]').trigger('click');
			});

			$(window).on('keypress', function(e){
				if(e.keyCode == 115){
					$('[p-select="btn-user-sync"]').trigger('click');
				}
			})

			$('[p-select="pointer"]').on('click', function() {
				if(permissionDoc.indexOf(currUcode) > -1) {
					if($(this).hasClass('active')) {
						$(this).removeClass('active');
						//$('.viewer-mark').removeClass('show');
						documentInit.setDocumentMouseMarkShowHide('hide');
						conferenceInit.mode.pointer = false;
						socketInit.io.emit('setPointerMode', {confCode: confCode, pointer: false});

						$('[p-select="mouse-mark-box"]').addClass('hide');

					}else{
						$(this).addClass('active');
						//$('.viewer-mark').addClass('show');
						documentInit.setDocumentMouseMarkShowHide('show');
						conferenceInit.mode.pointer = true;
						socketInit.io.emit('setPointerMode', {confCode: confCode, pointer: true});

						$('[p-select="mouse-mark-box"]').removeClass('hide');
					}
				}
			});

			// $('[p-select="btn-screen-share"]').on('click', function(){
			// 	if(navigator.mediaDevices.getDisplayMedia == null) {
			// 		return alarmInit.showToast(currUserInfo.message['1096'][getCookie('smp_lang') || 'kr'], 'top-center', 'error');
			// 	}

			// 	if(conferenceInit.mode.screenShare == false) {
			// 		if(permissionDoc.indexOf(currUcode) > -1) {
			// 			conferenceInit.setStatus({screenShare: true});
			// 			$('[p-select="btn-screen-share"]').addClass('checked');
			// 			presenterObj.stopSharing();
			// 			presenterObj.registerNodeEvents();
			// 			caller();
			// 		}
			// 	}else{
			// 		conferenceInit.setStatus({screenShare: false});
			// 		$('[p-select="btn-screen-share"]').removeClass('checked');
			// 		presenterObj.stopSharing();
			// 	}
			// });

			// $('[p-select="btn-live-streaming"]').on('click', function(){
            // 	liveStreamingInit.getStreamingList();
			// 	showPopup($('.js-popup-livestreaming'));
			// });


			// 판서버튼클릭.
			$('[p-select="btn-blackboard"], [p-select="fv-btn-blackboard"]').on('click', async function(){
				let fileCheck = await defaultInit.fileCheck(PDFViewerApplication.baseUrl);
				if(conferenceInit.mode.blackboard == false && (PDFViewerApplication.baseUrl == null || fileCheck == false || PDFViewerApplication.baseUrl == '/pdfs/empty.pdf')) {
					return customAlert('1084');
				}

				if(conferenceInit.mode.blackboard == false) {
					$('#whiteboardCanvas').css('pointer-events', 'auto');

					// 판서가 없는 상태에서 판서 버튼을 클릭하면 발표자 본인의 화면은 판서가 나오는데 참가자는 안 나온다.
					console.log("conferenceInit.mode.blackboard == false");
					$('body').attr('blackboard-mode', 'true');
					$('#whiteboard__layer').addClass('show');
					$('[p-select="btn-blackboard"]').addClass('checked');
					$('[p-select="whiteboard-util"]').addClass('active');
					$('#butils-slide').addClass('fullScreenSet');;

					conferenceInit.setStatus({blackboard: true});

					if (permissionDoc.includes(currUcode)) {
						whiteboardInit.setDraw();
					}
					//buffer에서 그림 그려주기 끝
				}else{

					// 판서가 그려진 상태에서 판서버튼을 클릭해서 판서를 제거했을 때
					console.log("conferenceInit.mode.blackboard == true");

					$('body').removeAttr('blackboard-mode');
					$('#whiteboard__layer').removeClass('show');
					$('[p-select="btn-blackboard"]').removeClass('checked');
					$('[p-select="whiteboard-util"]').removeClass('active');
					$('#butils-slide').removeClass('fullScreenSet');

					conferenceInit.setStatus({blackboard: false});

					whiteboardInit.clear();
				}
			});		

			$('[p-select="btn-user-sync"]').on('click', function(){
				if(conferenceInit.mode.sync == false || permissionDoc.indexOf(currUcode) > -1) {
					if(permissionDoc.indexOf(currUcode) == -1) {
						$(this).addClass('checked');
						$('[p-select="fv-btn-sync"]').addClass('checked');

						socketInit.io.emit('livestreamingGetInfo', { confCode: confCode});
					}else{
						alarmInit.showToast(currUserInfo.message['1085'][getCookie('smp_lang') || 'kr'], 'bottom-right', 'info');
						socketInit.io.emit('setUserSyncSetting', {confCode: confCode});
					}

					defaultInit.setDefaultMode();
					conferenceInit.setStatus({sync: true});

					if(permissionDoc.indexOf(currUcode) == -1) {
						conferenceInit.userSyncSetting();
					}
				}else{
					if(conferenceInit.mode.seminar == true) return customAlert('1083');
					$(this).removeClass('checked');
					$('[p-select="fv-btn-sync"]').removeClass('checked');
					conferenceInit.setStatus({sync: false});
				}
			});

			$('[p-select="btn-seminar"]').on('click', function(){
				if(conferenceInit.mode.seminar == false) {
					$(this).addClass('checked');
					$('[p-select="btn-user-sync"]').addClass('checked');
					$('[p-select="fv-btn-sync"]').addClass('checked');
					conferenceInit.setStatus({seminar: true, sync: true});
				}else{
					$(this).removeClass('checked');
					/*$('[p-select="btn-user-sync"]').removeClass('checked');
					$('[p-select="fv-btn-sync"]').removeClass('checked');*/
					conferenceInit.setStatus({seminar: false});
				}
			});

			$('[p-select="util-prev"]').on('click', function(evt){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault();
			        customAlert('1086');
			        return false;
			    }

				if(PDFViewerApplication.page == 1) return;
				PDFViewerApplication.page = (PDFViewerApplication.page-1)
			});

			$('[p-select="util-next"]').on('click', function(evt){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault()
			        customAlert('1086');
			        return false;
			    }

				if(PDFViewerApplication.page == PDFViewerApplication.pagesCount) return;
				PDFViewerApplication.page = (PDFViewerApplication.page+1)
			});
			
			//스와이프 기능
			//터치했을때 width값이 가로로 스크롤이 생길 경우 터치를 20이상 늘려야지만 스와이프 가능

			let startX, startY;
			let deltaX, deltaY;
			let canvas;
			
			function pageUp(){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
					evt.stopImmediatePropagation()
					evt.stopPropagation()
					evt.preventDefault()
					customAlert('1086');
					return false;
				}

				if(conferenceInit.mode.sync == false || permissionDoc.indexOf(currUcode) > -1){

				} else{
					if(conferenceInit.mode.seminar == true) return customAlert('1083');
					$('[p-select="btn-user-sync"]').removeClass('checked');
					$('[p-select="fv-btn-sync"]').removeClass('checked');
					conferenceInit.setStatus({sync: false});
				}

				if(PDFViewerApplication.page == PDFViewerApplication.pagesCount) return;
				PDFViewerApplication.page = (PDFViewerApplication.page + 1);
			};

			function pageDown(){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
					evt.stopImmediatePropagation()
					evt.stopPropagation()
					evt.preventDefault();
					customAlert('1086');
					return false;
				}

				if(conferenceInit.mode.sync == false || permissionDoc.indexOf(currUcode) > -1){

				} else{
					if(conferenceInit.mode.seminar == true) return customAlert('1083');
					$('[p-select="btn-user-sync"]').removeClass('checked');
					$('[p-select="fv-btn-sync"]').removeClass('checked');
					conferenceInit.setStatus({sync: false});
				}

				if(PDFViewerApplication.page == 1) return;
				PDFViewerApplication.page = (PDFViewerApplication.page - 1);
			}


			function swipe(){
				$('#viewer').on('touchstart', function(evt){
					startX = evt.touches[0].pageX;
					startY = evt.touches[0].pageY;
					canvas = document.querySelector('#viewer > div');
				});
	
				$('#viewer').on('touchmove', function(evt){
					let moveX = evt.changedTouches[0].clientX;
					let moveY = evt.changedTouches[0].clientY;
					deltaX = moveX - startX;
					deltaY = moveY - startY;
					
				});

				$('#viewer').on('touchend', function(evt){
					let endX = evt.changedTouches[0].pageX;
					
					if(canvas.offsetWidth < window.innerWidth){
						
						if(Math.abs(deltaX) > 20 || Math.abs(deltaY) > 20){
							if(Math.abs(deltaX) > Math.abs(deltaY)){
								deltaX = 0; 
								deltaY = 0;
								
								if(endX < startX){
									pageUp();
								} else if (endX > startX) {
									pageDown();
								}
							} else {
								deltaX = 0; 
								deltaY = 0;
							}	
						}

					} else if (canvas.offsetWidth >= window.innerWidth){
						
						if(Math.abs(deltaX) > 800 || Math.abs(deltaY) > 800){
							if(Math.abs(deltaX) > Math.abs(deltaY)){
								deltaX = 0; 
								deltaY = 0;
								
								if(endX < startX){
									pageUp();
								} else if (endX > startX) {
									pageDown();
								}
							} else {
								deltaX = 0; 
								deltaY = 0;
							}	
						}

					}
				});
			}

			swipe();

			$('[p-select="util-exchange"]').on('click', function(){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault();
			        customAlert('1086');
			        return false;
			    }

				let prevPage = window.documentPrevPage;
				window.documentPrevPage = PDFViewerApplication.page;
				PDFViewerApplication.page = prevPage;
			});

			$('[p-select="util-page"]').on('blur', function(evt){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault()

			        return customAlert('1086');
			    }

				let value = $(this).val();
				if($.isNumeric(value) == false) {
					$(this).val(PDFViewerApplication.page);
				}else{
					value = parseInt(value);
					if(value == 0 || value > PDFViewerApplication.pagesCount) {
						$(this).val(PDFViewerApplication.page);
					}else{
						PDFViewerApplication.page = value;
					}
				}
			});

			$('[p-select="util-page"]').on('keyup', function(evt){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault()

			        return customAlert('1086');
			    }

				if(evt.keyCode == 13) {
					let value = $(this).val();
					if($.isNumeric(value) == false) {
						$(this).val(PDFViewerApplication.page);
					}else{
						value = parseInt(value);
						if(value == 0 || value > PDFViewerApplication.pagesCount) {
							$(this).val(PDFViewerApplication.page);
						}else{
							PDFViewerApplication.page = value;
						}
					}
				}
			});

			$('[p-select="util-hor"]').on('click', function(){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault()
			        customAlert('1086');
			        return false;
			    }
				PDFViewerApplication.pdfViewer.currentScaleValue = 'page-width';
				documentInit.changeScale();
				defaultInit.userSyncToggle();

				whiteboardInit.setCanvasSize();
				
			});

			$('[p-select="util-ver"]').on('click', function(){
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault()
			        customAlert('1086');
			        return false;
			    }
				PDFViewerApplication.pdfViewer.currentScaleValue = 'page-fit';
				documentInit.changeScale();
				defaultInit.userSyncToggle();

				whiteboardInit.setCanvasSize();

			});

			// $('[p-select="fullscreen"]').on('click', function(){
			// 	toggleFullScreen();
			// });

			$('[p-select="toggle-sidebar"]').on('click', function(){
				PDFViewerApplication.pdfSidebar.toggle();
			});

			// 줌 인 스크롤 오류 수정
			$('[p-select="util-zoom-in"]').on('click', function() {
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault()
			        customAlert('1086');
			        return false;
			    }
				PDFViewerApplication.zoomIn();
				defaultInit.userSyncToggle();
			});

			$('[p-select="util-zoom-out"]').on('click', function() {
				if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == true) {
			        evt.stopImmediatePropagation()
			        evt.stopPropagation()
			        evt.preventDefault()
			        customAlert('1086');
			        return false;
			    }
				PDFViewerApplication.zoomOut();
				defaultInit.userSyncToggle();
			});

			$('[p-select="headerUserId"]').text(currId);
			$('[p-select="headerUserName"]').text(currName);
			$('[p-select="room-out"]').on('click', function() {
				location.href = '/';
			});

			if(conferenceInit.nowServerTime > conferenceEndDate) {
				defaultInit.endCheck = true;
				$('[p-select="bookmark-save"], [p-select="bookmark-popup"], [p-select="create-vote-btn"], #chatMessage, #chatMessageBtn, [p-select="memoTitle"], [p-select="saveMemo"], [p-select="minutesFieldset"] input').attr('disabled', 'disabled');
				$('[p-select="memoContentLayer"] .richText-editor').removeAttr('contenteditable');
			}

			conferenceInit.checkEndConference = () => {
				if (conferenceInit.nowServerTime > conferenceEndDate) {
					alarmInit.showToast('회의가 종료되었습니다. 회의방을 나갑니다.', 'top-center', 'warning', function() {
						location.href = '/';  // 회의 종료 후 자동 퇴장
					});
			
					setTimeout(() => {
						location.href = '/';  // 일정 시간이 지난 후 강제 퇴장
					}, 5000);
				}
			};
			
			// 회의 상태 체크
			setInterval(conferenceInit.checkEndConference, 3000);

			PDFViewerApplication.eventBus.on('sidebarviewchanged', function pagechange(evt) {
				if(evt.source.isOpen == false) {
					$('.menu__sbtn1').removeClass('rotate');
				}else{
					$('.menu__sbtn1').addClass('rotate');
				}
			});

			defaultInit.getLogo();
		},

		getPresenterInfo: () => {
			socketInit.io.emit('getPresenterInfo', { confCode: confCode});
		},

		setDefaultMode: () => {
			conferenceInit.mode.page = PDFViewerApplication.page;
			if(PDFViewerApplication.baseUrl != null) conferenceInit.mode.pdf = PDFViewerApplication.baseUrl.replace('/pdfs/', '');
			conferenceInit.mode.zoom = PDFViewerApplication.pdfViewer.currentScaleValue;
		},

		setChangeUserVolum: async (type) => {
			await conferenceInit.getPresenter();
			let voiceElement = $('.grid-item');

			voiceElement.map(function(i, v) {
				let uc = $(v).attr('p-ucode');
				if(uc != null && permissionVoc.indexOf(uc) == -1) {
					$(v).find('audio')[0].volume = 0;
				}else if(uc != null && permissionVoc.indexOf(uc) > -1 && type == 'change') {
					$(v).find('audio')[0].volume = 1;
				}
			});
		},

		userSyncToggle: () => {
			console.warn('--------');
			if(conferenceInit.mode.type == 'first') {
				delete conferenceInit.mode.type;
				//return;
			}

			if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.seminar == false && conferenceInit.mode.sync == true) {
				if(conferenceInit.remoteChangeCheck == true) {
					conferenceInit.remoteChangeCheck = false;
					return;
				}

				conferenceInit.mode.sync = false;
				$('[p-select="btn-user-sync"]').removeClass('checked');
				$('[p-select="fv-btn-sync"]').removeClass('checked');
			}
		},
		userActionBind: () => {
			$('#thumbnailView a, [p-select="util-prev"], [p-select="util-next"], [p-select="util-exchange"]').off('mousedown.uab').on('mousedown.uab', function(e){
				defaultInit.userSyncToggle();
			});

			$('#viewerContainer').off('scroll.bvs').on('scroll.bvs', function(e){
				if($(this).data('removeScroll') == 'true') {
					$(this).removeData('removeScroll');
					return;
				}

				if($(this).data('removeScroll') == 'only') {
					return;
				}

				if(conferenceInit.pageChangeCheck == true) {
					conferenceInit.pageChangeCheck = false;
					return;
				}
				defaultInit.userSyncToggle();
				
				if(conferenceInit.mode.sync == true && permissionDoc.indexOf(currUcode) > -1) {
					var t = $('#viewerContainer').scrollTop();
					var vh = $('#viewer').height();
					var left = document.querySelector('.canvasWrapper').getBoundingClientRect();
				
					//가로 x 축
					var x = $('#viewerContainer').scrollLeft();
					var vw = $('#viewer').width();
					
					socketInit.io.emit('viewerScrollTop', { confCode: confCode, t: t, h: vh, x : x, w: vw });
				}

				if(defaultInit.scrollSetTimeout != null) clearTimeout(defaultInit.scrollSetTimeout);
				defaultInit.scrollSetTimeout = setTimeout(function(){
					documentInit.sendPageChange('notsend');
				}, 1500);
			});
		},
		fileCheck: (pdf) => {
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				url : '/files/check/pdf',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					pdfUrl:pdf
				}),
				success: function(data) {
					deferred.resolve(data.result);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
			return deferred.promise();
		},
		toggleFullScreen: () => {
			if ($('body').hasClass('fv') == false) {
				if(conferenceInit.mode.blackboard == true) {
					whiteboardInit.setDraw(); 
				}
				
				var element = document.querySelector('body');

				if (element.requestFullscreen) {
					element.requestFullscreen().catch(err => {
						console.error("Error attempting to enable full-screen mode: ", err.message);
					});
				} else if (element.webkitRequestFullscreen) { /* Safari */
					element.webkitRequestFullscreen().catch(err => {
						console.error("Error attempting to enable full-screen mode: ", err.message);
					});
				} else if (element.mozRequestFullScreen) { /* Firefox */
					element.mozRequestFullScreen().catch(err => {
						console.error("Error attempting to enable full-screen mode: ", err.message);
					});
				} else if (element.msRequestFullscreen) { /* IE/Edge */
					element.msRequestFullscreen().catch(err => {
						console.error("Error attempting to enable full-screen mode: ", err.message);
					});
				}
				$('body').attr('full-screen', 'true');
				

				$('header, .main, body').addClass('fv');
				$('#butils-slide').removeClass('fullScreenSet');

				$('[p-select="fullscreen"]').removeClass('icon-arrow-zoom').addClass('icon-arrow-zoom-in');
				$('[p-select="fullscreen"] > use').attr('xlink:href', '#icon-arrow-zoom-in');

				if(conferenceInit.mode.blackboard == true) { $('#butils-slide').addClass('fullScreenSet'); }

				PDFViewerApplication.pdfViewer.currentScaleValue = PDFViewerApplication.pdfViewer.currentScaleValue;
			} else {
				if(conferenceInit.mode.blackboard == true) {
					whiteboardInit.setDraw(); 
				}

				var element = document.querySelector('body');
				 if (document.fullscreenElement) {
					if (document.exitFullscreen) {
						document.exitFullscreen().catch(err => {
							console.error("Error attempting to disable full-screen mode: ", err.message);
						});
					} else if (document.webkitExitFullscreen) { /* Safari */
						document.webkitExitFullscreen().catch(err => {
							console.error("Error attempting to disable full-screen mode: ", err.message);
						});
					} else if (document.mozCancelFullScreen) { /* Firefox */
						document.mozCancelFullScreen().catch(err => {
							console.error("Error attempting to disable full-screen mode: ", err.message);
						});
					} else if (document.msExitFullscreen) { /* IE/Edge */
						document.msExitFullscreen().catch(err => {
							console.error("Error attempting to disable full-screen mode: ", err.message);
						});
					}
					$('body').removeAttr('full-screen');
				} else {
					console.warn("Document is not in full-screen mode.");
				}
				
				$('header, .main, body').removeClass('fv');
				$('#butils-slide').removeClass('fullScreenSet');

				$('[p-select="fullscreen"]').removeClass('icon-arrow-zoom-in').addClass('icon-arrow-zoom');
				$('[p-select="fullscreen"] > use').attr('xlink:href', '#icon-arrow-zoom');

				if(conferenceInit.mode.blackboard == true) { $('#butils-slide').addClass('fullScreenSet'); }

				PDFViewerApplication.pdfViewer.currentScaleValue = PDFViewerApplication.pdfViewer.currentScaleValue;
			}
		},
		getLogo: () => {
			var deferred = $.Deferred();
		$.ajax({
			beforeSend: beforeSend,
			url : '/files/settings/get',
			type : 'POST',
			contentType: 'application/json; charset=utf-8',
			success: function(data) {
				let result = data.result;
				let chekced = {
					confBackLogo : false,
					userTopLogo  : false,
					adminTopLogo : false,
					confThumImg  : false
				};

				for(let i of result) {
					const type = i.type;
					chekced[type] = true;
					if(type == 'confBackLogo') {
						$('#viewerContainer').attr('style', `background-image: url(/files/${i.filename})`);
						$('[p-select="loading-img1"]').attr('src', `/files/${i.filename}`);
						$('[p-select="loading-img2"]').attr('src', `/files/${i.filename}`);
					}else if(type == 'userTopLogo') {
						$('[p-select="user-logo"]').attr('style', `background-image: url(/files/${i.filename})`);
					}else if(type == 'adminTopLogo') {
						$('[p-select="admin-logo"]').attr('style', `background-image: url(/files/${i.filename})`);
					}else if(type == 'confThumImg') {
						//$('[p-select="confThumImg"]').attr('src', `/files/${i.filename}`);
						window.defaultConfThumImg = `/files/${i.filename}`;
					}
				}

				if(chekced['confBackLogo'] == false) {
					$('#viewerContainer').attr('style', 'background-image: url(/files/default/confBackLogo.png)');
				}

				if(chekced['userTopLogo'] == false) {
					$('[p-select="user-logo"]').attr('style', 'background-image: url(/files/default/userTopLogo.png)');
				}

				if(chekced['adminTopLogo'] == false) {
					$('[p-select="admin-logo"]').attr('style', 'background-image: url(/files/default/adminTopLogo.png)');
				}

				if(chekced['confThumImg'] == false) {
					window.defaultConfThumImg = '/files/default/confThumImg.png';
				}
				deferred.resolve();
			},
			error: function(e) {
				if(e?.responseJSON?.errorCode == 'auth_failed') {
					customAlert('1098');
					parent.location.href = '/';
				}
				var message = e?.responseJSON?.message;
				if(message) return alert(message);
			}
		});
		return deferred.promise();
		}
	}

	window.conferenceInit = {
		setting: {
			chattingAlarm: true,
			voteAlarm: true,
			confRenew: 10,
			lang: 'korean'
		},
		mode: {
			sync: true,
			seminar: false,
			blackboard: false,
			screenShare: false,
			pdf: null,
			page: null
		},
		remoteChangeCheck: false,
		pageChangeCheck: false,
		participant: null,
		scrollStartCheck: true,
		getSyncDataInterval: null,
		init: async () => {
			function wheelStopListener(element, callback, timeout) {
		        var handle = null;
		        var onScroll = function(e) {
					console.log("스크롤시 페이지 이동 방지")
					if (e.ctrlKey) return; // Ctrl+Scroll 시 페이지 이동 방지

		        	if(conferenceInit.mode.seminar == true && permissionDoc.indexOf(currUcode) == -1) return;
					
		        	if(conferenceInit.scrollStartCheck == true) {
		        		conferenceInit.scrollStartCheck = false;
		        	}
		            if (handle) {
		                clearTimeout(handle);
		                handle = null;
		            }
		            handle = setTimeout(function(){
		            	callback(e);

		            	defaultInit.userSyncToggle();

		            }, timeout || 200); // default 200 ms
		        };
		        element.addEventListener('wheel', onScroll);
		        return function() {
		            element.removeEventListener('wheel', onScroll);
		        };
		    }
		    wheelStopListener($('#viewerContainer')[0], function(e) {
		        conferenceInit.scrollStartCheck = true;
		        conferenceInit.pageEndCheck(e);
		    });

			$('[p-bind="settingSave"]').on('click', function(){

				for(let i in conferenceInit.setting) {
					if($(`[p-select="setting-${i}"]`).prop('type') == 'checkbox') {
						conferenceInit.setting[i] = $(`[p-select="setting-${i}"]`).is(':checked');
					}else if($(`[p-select="setting-${i}"]`).prop('tagName') == 'SELECT') {
						conferenceInit.setting[i] = $(`[p-select="setting-${i}"]`).val();
					}
				}

				conferenceInit.setSetting();
				hidePopup($('.js-popup-setting'));
			});

			await documentInit.getDocumentList();

			conferenceInit.initSetting();
			conferenceInit.getStatus('first');

			conferenceInit.participant = await conferenceInit.getParticipant() || [];

			let cuCheck = false;
			for(let i of conferenceInit.participant) {
				if(i.ucode == currUcode) cuCheck = true;
			}

			if(cuCheck == false){
				conferenceInit.participant.push({id: currId, name: currName, ucode: currUcode})
			}

			if(permissionDoc.indexOf(currUcode) > -1) {
				conferenceInit.setStatus({screenShare: false});
				presenterObj.stopSharing();
			}

			conferenceInit.setSyncDataInterval();
		},
		pageEndCheck: (e) => {
			const vh = $('#viewer').height();
			const vcs = $('#viewerContainer').scrollTop();
			const vch = $('#viewerContainer').height();
			/*console.log("vh : ", vh);
			console.log("vch : ", vch);
			console.log("vcs : ", vcs);
			console.log("PDFViewerApplication.pagesCount : ", PDFViewerApplication.pagesCount);
			console.log("PDFViewerApplication.page : ", PDFViewerApplication.page);
			console.log("e.deltaY : ", e.deltaY);
			console.log("---------------------------------------------------");*/

			if(parseInt(vh) <= Math.ceil(vch+vcs) && PDFViewerApplication.pagesCount > PDFViewerApplication.page && e.deltaY > 0) {
				PDFViewerApplication.page++;
				$('#viewerContainer').scrollTop(0);
			}else if(vcs == 0 && PDFViewerApplication.page != 1 && e.deltaY < 0){
				PDFViewerApplication.page--;
				$('#viewerContainer').scrollTop(vch);
			}
		},
		setSyncDataInterval: () => {
			if(conferenceInit.getSyncDataInterval == null && permissionDoc.indexOf(currUcode) == -1) {
				conferenceInit.getSyncDataInterval = setInterval(function(){
					if($('[p-select="live-streaming-box"]').is(':visible') == true) return;

					socketInit.io.emit('getSyncData', {confCode: confCode});

					if(conferenceInit.mode == false && $('[p-select="btn-user-sync"]').hasClass('checked')){
						$('[p-select="btn-user-sync"]').removeClass('checked')
					}
				}, 1000);
			}else{
				clearInterval(conferenceInit.getSyncDataInterval);
				conferenceInit.getSyncDataInterval = null;
			}
		},
		setInfo: () => {
			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/getInfo',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode
				}),
				success: function(data) {
					data = data.result;
					let runningTime = '';
					let mode = '';
					let sync = '';
					let sharing = '';
					let gap = data.edate - data.sdate;

					const days = Math.floor(gap / (1000 * 60 * 60 * 24));
					const hour = String(Math.floor((gap/ (1000 * 60 *60 )) % 24 )).padStart(2, "0");
					const minutes = String(Math.floor((gap  / (1000 * 60 )) % 60 )).padStart(2, "0");
					const second = String(Math.floor((gap / 1000 ) % 60)).padStart(2, "0");

					if(days != 0) {
						runningTime += `${days+_spl('day')} `;
					}

					if(days != 0 || hour != '00') {
						runningTime += `${hour+_spl('hours')} `;
					}

					if(days != 0 || hour != '00' || minutes != '00') {
						runningTime += `${minutes+_spl('minute')} `;
					}

					if(days != 0 || hour != '00' || minutes != '00' || second != '00') {
						runningTime += `${second+_spl('second')}`;
					}

					if(conferenceInit.mode.seminar == false && conferenceInit.mode.blackboard == false) {
						mode = _spl('generalConf');
					}else if(conferenceInit.mode.seminar == false && conferenceInit.mode.blackboard == true) {
						mode = _spl('blackboard');
					}else if(conferenceInit.mode.seminar == true && conferenceInit.mode.blackboard == true) {
						mode = _spl('SeminarBlack');
					}else if(conferenceInit.mode.seminar == true && conferenceInit.mode.blackboard == false) {
						mode = _spl('seminar');
					}

					if(conferenceInit.mode.sync == true) {
						sync = _spl('userForceSync');
					}else{
						sync = _spl('asynchronization');
					}

					if(conferenceInit.mode.screenShare == true) {
						sharing = _spl('shareScreenIng');
					}else{
						sharing = _spl('spacingNotSharing');
					}


					$('[p-select="conf-title"]').text(data.name);
					$('[p-select="current-pname"]').text(data.user?.name || _spl('empty'));
					$('[p-select="conf-date"]').text(runningTime);

					$('[p-select="conf-sync"]').text(sync);
					$('[p-select="conf-mode"]').text(mode);
					$('[p-select="conf-sharing"]').text(sharing);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},
		setSyncButton: async () => {
			await conferenceInit.getPresenter();

			if(permissionDoc.indexOf(currUcode) > -1) {
				$('[p-select="user-force-sync"]').hide();
				$('[p-select="force-sync"]').show();
			}else{
				$('[p-select="user-force-sync"]').show();
				$('[p-select="force-sync"]').hide();
			}
		},

		userSyncSetting: () => {
			socketInit.io.emit('userSyncSetting', {confCode: confCode});
		},

		getStatus: (type) => {
			socketInit.io.emit('getStatus', {confCode: confCode, type: type});
		},

		setStatus: (data) => {
			for(let i in data) {
				if(i != 'blackboard' && i != 'page' && i != 'pdf' && i != 'screenShare' && i != 'seminar' && i != 'sync' ) return;
				if(data[i] !== true && data[i] !== false ) return;

				conferenceInit.mode[i] = data[i];
			}

			if(permissionDoc.indexOf(currUcode) > -1) {
				socketInit.io.emit('setStatus', {confCode: confCode, mode: conferenceInit.mode});
			}
		},

		getSetting: (setting) => {
			let settingData = getCookie(`sp_conference_setting_${confCode}`);
			if(setting == null) {
				return JSON.parse(settingData || '{}');
			}else{
				settingData = JSON.parse(settingData || '{}');
				return settingData[setting];
			}
		},
		setSetting: (setting, value) => {
			if(setting != null) {
				conferenceInit.setting[setting] = value;
			}
			setCookie(`sp_conference_setting_${confCode}`, JSON.stringify(conferenceInit.setting), null, parseInt(conferenceEndDate), 'Strict');
		},
		initSetting: () => {
			let settingData = getCookie(`sp_conference_setting_${confCode}`);
			settingData = JSON.parse(settingData || '{}');
			if(settingData != null && Object.keys(settingData).length > 0) {
				for(let i in settingData) {
					if(settingData[i] != null) {
						conferenceInit.setting[i] = settingData[i];
						if($(`[p-select="setting-${i}"]`).prop('type') == 'checkbox') {
							$(`[p-select="setting-${i}"]`).prop('checked', conferenceInit.setting[i]);
						}else if($(`[p-select="setting-${i}"]`).prop('tagName') == 'SELECT') {
							$(`[p-select="setting-${i}"]`).val(conferenceInit.setting[i]).niceSelect('update');
						}

					}
				}
			}
		},
		setAuthVoice: (userCode, type) => {
			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/voice/setAuth',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					userCode: userCode,
					type: type
				}),
				success: function(data) {
					/*socketInit.io.emit('changeAuthSpeaker', {confCode: confCode, userCode: userCode});*/
					socketInit.events.conference.changePresenter();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},
		setAuthDocument: (userCode, type) => {
			if(permissionDoc.indexOf(currUcode) > -1 && conferenceInit.mode.screenShare == true) {
				conferenceInit.setStatus({screenShare: false});
				presenterObj.stopSharing();
			}

			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/document/setAuth',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					userCode: userCode,
					type: type
				}),
				success: function(data) {
					//socketInit.events.conference.changePresenter();
					socketInit.io.emit('changePresenter', {confCode: confCode});
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},
		setPresenterAuth: (ucode) => {
			if(permissionDoc.indexOf(currUcode) > -1 && conferenceInit.mode.screenShare == true) {
				conferenceInit.setStatus({screenShare: false});
				presenterObj.stopSharing();
			}

			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/presenter/auth',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					ucode: ucode
				}),
				success: function(data) {
					socketInit.io.emit('changePresenter', {confCode: confCode});
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},
		setPresenterRequest: (userUcode) => {
			socketInit.io.emit('requestPresenter', {confCode:confCode, userUcode:userUcode, type: 'presenter'});
			typpeInit.hideAllTyppy();
			alarmInit.showToast(_spl('requsetedPresenter'), 'bottom-right', 'info');
		},
		getPresenter: () => {
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/presenter/getter',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode
				}),
				success: function(data) {
					let result = data.result;
					permissionDoc = result['permission_doc'];
					permissionVoc = result['permission_voc'];
					deferred.resolve();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
			return deferred.promise();
		},
		getParticipant: () => {
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/getParticipant',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					confCode: confCode
				}),
				success: function(data) {
					let result = data.result;
					deferred.resolve(result);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
			return deferred.promise();
		},
		showFullscreenPrompt: () => {
			const btn = document.getElementById('fullscreenPromptBtn');
			if (!btn || btn.style.display === 'block') return;
		  
			btn.style.display = 'block';
		  
			const timeoutId = setTimeout(() => {
			  btn.style.display = 'none';
			  whiteboardInit.setDraw();
			}, 5000);
		  
			btn.onclick = () => {
			  btn.style.display = 'none';
			  clearTimeout(timeoutId);

			  defaultInit.toggleFullScreen();

			  $('#viewerContainer').data('removeScroll', 'only');
			  $('.main__menu.side__menu.active').removeClass('active');
			  PDFViewerApplication.pdfSidebar.close();
			  $('[p-select="setting-panel"]').removeClass('active visible');
			  setTimeout(() => $('#viewerContainer').removeData('removeScroll'), 500);
			};
		},
		  
		hideFullscreenPrompt :() => {
			const btn = document.getElementById('fullscreenPromptBtn');
			if (btn) {
			  btn.style.display = 'none';
			}
		},
	}

	window.alarmInit = {
		showToast: (message, position, type, func) => {
			toastr.options.timeOut = 10000;
			if(position == 'bottom-right') {
				toastr.options.positionClass = "toast-bottom-right";
			}else if(position == 'top-center') {
				toastr.options.positionClass = "toast-top-center";
			}else{
				toastr.options.positionClass = "toast-top-right";
			}

			if(func != null) {
				toastr.options.onclick = func;
			}

			toastr[type](message);
		}
	}

	let typpeInit = {
		userTyppyInstance: null,
		typpyInstance: null,
		voteTyppyInstance: null,
		hideAllTyppy: () => {
			if(typpeInit.typpyInstance != null) {
				for(let i of typpeInit.typpyInstance) {
					i.hide();
				}
			}

			if(typpeInit.userTyppyInstance != null) {
				for(let i of typpeInit.userTyppyInstance) {
					i.hide();
				}
			}

			if(typpeInit.voteTyppyInstance != null) {
				for(let i of typpeInit.voteTyppyInstance) {
					i.hide();
				}
			}
		},
		setUserTyppy: () => {
			let content = `<div class="actions actions_small">
								<div class="list__item actions__body">
									<button type="button" class="actions__option" p-select="presenter-auth">
										<svg class="icon icon-messages">
											<use xlink:href="#icon-messages"></use>
										</svg> ${_spl('grantPresenter')}
									</button>
									<button type="button" class="actions__option" p-select="presenter-request">
										<svg class="icon icon-seminar">
											<use xlink:href="#icon-seminar"></use>
										</svg> ${_spl('requestPresenter')}
									</button>
									<button type="button" class="actions__option" p-select="user-exit">
										<svg class="icon icon-close-circle">
											<use xlink:href="#icon-close-circle"></use>
										</svg> ${_spl('exiting')}
									</button>
								</div>
							</div>`;

			if(conferenceType == '1') {
				content = `<div class="actions actions_small">
								<div class="list__item actions__body">
									<button type="button" class="actions__option" p-select="document-remove">
										<svg class="icon icon-messages">
											<use xlink:href="#icon-messages"></use>
										</svg> ${_spl('removeDoc')}
									</button>
									<button type="button" class="actions__option" p-select="document-auth">
										<svg class="icon icon-messages">
											<use xlink:href="#icon-messages"></use>
										</svg> ${_spl('grantDoc')}
									</button>
									<button type="button" class="actions__option" p-select="document-request">
										<svg class="icon icon-seminar">
											<use xlink:href="#icon-seminar"></use>
										</svg> ${_spl('requestDoc')}
									</button>
									<button type="button" class="actions__option" p-select="document-pass">
										<svg class="icon icon-seminar">
											<use xlink:href="#icon-seminar"></use>
										</svg> ${_spl('transferDoc')}
									</button>
									<button type="button" class="actions__option" p-select="voice-remove">
										<svg class="icon icon-messages">
											<use xlink:href="#icon-messages"></use>
										</svg> ${_spl('removeVoice')}
									</button>
									<button type="button" class="actions__option" p-select="voice-auth">
										<svg class="icon icon-messages">
											<use xlink:href="#icon-messages"></use>
										</svg> ${_spl('grantVoice')}
									</button>
									<button type="button" class="actions__option" p-select="voice-request">
										<svg class="icon icon-seminar">
											<use xlink:href="#icon-seminar"></use>
										</svg> ${_spl('requestVoice')}
									</button>
									<button type="button" class="actions__option" p-select="voice-pass">
										<svg class="icon icon-seminar">
											<use xlink:href="#icon-seminar"></use>
										</svg> ${_spl('transferVoice')}
									</button>
									<button type="button" class="actions__option" p-select="user-exit">
										<svg class="icon icon-close-circle">
											<use xlink:href="#icon-close-circle"></use>
										</svg> ${_spl('exiting')}
									</button>
								</div>
							</div>`
			}
			typpeInit.userTyppyInstance = tippy('[p-select="user-util-btn"]', {
				content: content,
				allowHTML: true,
				popperOptions: {
				    positionFixed: true
				},
				appendTo: document.body,
				interactive: true,
				zIndex: 100000,
				trigger: 'click',
				onTrigger: (instance, event) => {
					event.stopPropagation();
				},
				onShow: (instance) => {
					let userUcode 	= $(instance.reference).attr('p-ucode');
					let docAuth 	= $(instance.reference).attr('p-doc-auth');
					let vocAuth 	= $(instance.reference).attr('p-voc-auth');
					let role 		= $(instance.reference).attr('p-role');
					let authMap  	= {};

					if(conferenceType == '0'){
						authMap = {
							"presenter-auth": false,
							"presenter-request": false,
							"user-exit": false
						}

						if(currRole == 'admin' && userUcode != currUcode) {
							authMap['user-exit'] = true;
						}

						if(docAuth == 'true') {
							authMap['presenter-request'] = true;
						}else if( (docAuth == 'false' && userUcode != currUcode) || (currRole == 'admin')){
							authMap['presenter-auth'] = true;
						}
					}else{
						authMap = {
							"document-remove": false,
							"voice-remove": false,
							"document-auth": false,
							"voice-auth": false,
							"document-request": false,
							"voice-request": false,
							"document-pass": false,
							"voice-pass": false,
							"user-exit": false
						}

						if(currRole == 'admin') {
							if(docAuth == 'false') {
								authMap['document-auth'] = true;
							}else{
								authMap['document-remove'] = true;
							}

							if(vocAuth == 'false') {
								authMap['voice-auth'] = true;
							}else{
								authMap['voice-remove'] = true;
							}

							if(userUcode != currUcode){
								authMap['user-exit'] = true;
							}
						}else{
							if(role == 'admin') {
								if(permissionDoc.indexOf(currUcode) == -1) {
									authMap['document-request'] = true;
								}

								if(permissionVoc.indexOf(currUcode) == -1) {
									authMap['voice-request'] = true;
								}

								/*if(permissionDoc.indexOf(currUcode) > -1) {
									authMap['document-pass'] = true;
								}*/
							}

							if(permissionDoc.indexOf(currUcode) > -1) {
								authMap['document-pass'] = true;
							}
						}
					}

					let html = '';
					for(let i in authMap) {
						if(authMap[i] == true) {
							html += `[p-select="${i}"] {display:flex}`;
						}else{
							html += `[p-select="${i}"] {display:none}`;
						}
					}

					$('#userConfUtilStyle').html(html);
				},
				onShown: (instance) => {
					let userUcode = $(instance.reference).attr('p-ucode');

					if(conferenceType == '0') {
						$('[p-select="presenter-auth"]').off('click').on('click', function(e){
							e.stopPropagation();
							conferenceInit.setPresenterAuth(userUcode);
							//발표자 권한 부여시 기존 발표자 그림tool기능 없애기
							whiteboard.setTool("mouse");
							$('.whiteboard-tool.whiteboardActionBtn').removeClass('active');
						})

						$('[p-select="presenter-request"]').off('click').on('click', function(e){
							e.stopPropagation();
							conferenceInit.setPresenterRequest(userUcode);
						})

						$("[p-select='user-exit']").off('click').on('click', function(e){
							e.stopPropagation();
							userInit.userExit(userUcode);
						});
					}else{
						$("[p-select='document-remove']").off('click').on('click', function(e){
							e.stopPropagation();
							conferenceInit.setAuthDocument(userUcode, 'remove');
						});

						$("[p-select='voice-remove']").off('click').on('click', function(e){
							e.stopPropagation();
							conferenceInit.setAuthVoice(userUcode, 'remove');
						});

						$("[p-select='document-auth']").off('click').on('click', function(e){
							e.stopPropagation();
							conferenceInit.setAuthDocument(userUcode, 'auth');
						});

						$("[p-select='voice-auth']").off('click').on('click', function(e){
							e.stopPropagation();
							conferenceInit.setAuthVoice(userUcode, 'auth');
						});

						$("[p-select='document-request']").off('click').on('click', function(e){
							e.stopPropagation();
							documentInit.setDocumentRequest(userUcode);
						});


						$("[p-select='document-pass']").off('click').on('click', function(e){
							e.stopPropagation();
							conferenceInit.setAuthDocument(userUcode, 'auth');
						});
					}

				}
			});
		}
	}

	

	let userInit = {
		userExit: (userUcode) => {
			socketInit.io.emit('conferenceUserExit', {confCode:confCode, userUcode:userUcode});
			typpeInit.hideAllTyppy();
		},
		setUserTag: (data) => {
			$(`[p-select="setting-users"][p-ucode="${data.ucode}"]`).remove();

			let tag = `<a class="header__message new user__item" href="javascript:void(0)" p-select="setting-users" p-ucode="${data.ucode}">
				<div class="header__avatar">
					<img src="${common.isEmpty(data.photo)? '/assets/img/user.png':data.photo}" alt="Avatar">
					${(data.role == 'admin' ? `<svg class="icon icon-admin2 admin__icon" data-tippy-content=${_spl('admin')}><use xlink:href="#icon-admin2"></use></svg>`:'')}
				</div>
				<div class="auth__icons">
					<svg class="icon icon-seminar ${(permissionDoc.indexOf(data.ucode) > -1 ? '':'disabled')}" p-select="auth-document" data-tippy-content=${_spl('docPermission')}>
						<use xlink:href="#icon-seminar"></use>
					</svg>
					<svg class="icon icon-mic ${(permissionVoc.indexOf(data.ucode) > -1 ? '':'disabled')}" p-select="auth-voice" data-tippy-content=${_spl('microPermission')}>
						<use xlink:href="#icon-mic"></use>
					</svg>
				</div>
				<div class="header__details">
					<div class="header__line">
						<div class="header__subtitle">
							${data.name} ${common.isEmpty(data.position)? '':data.position}
						</div>
					</div>
					<div class="header__content">
						${common.isEmpty(data.department) ? '' : data.department}
					</div>
				</div>
				<div class="actions actions_small">
					<button class="actions__button" p-select="user-util-btn" p-doc-auth="${permissionDoc.indexOf(data.ucode) > -1 ? "true" : "false"}" p-voc-auth="${permissionVoc.indexOf(data.ucode) > -1 ? "true" : "false"}" p-role="${data.role}" p-ucode="${data.ucode}">
						<svg class="icon icon-more-horizontal">
							<use xlink:href="#icon-more-horizontal"></use>
						</svg>
					</button>
				</div>
			</a>`;
			let ele = null;
			let type = '';

			if(conferenceType == '0' && permissionDoc.indexOf(data.ucode) > -1) {
				ele = $(tag).appendTo('[p-select="conference-presenter"]');
				type = 'presenter';
			}else {
				ele = $(tag).appendTo('[p-select="conference-users"]');
				type = 'user';
			}

			if( (conferenceType == '0' && data.ucode == currUcode && type == 'presenter') ||
				(conferenceType == '0' && data.ucode == currUcode && data.role == 'user') ||
				(conferenceType == '1' && data.role == 'user' && data.ucode == currUcode)) {
					ele.find('[p-select="user-util-btn"]').remove();
			}
		},

		setChatUserTag: (data) => {
			$(`[p-select="chat-user"][p-ucode="${data.ucode}"]`).remove();

			if(data.ucode == currUcode) return;
			let tag = `<div class="messages__item new" p-ucode="${data.ucode}" p-name="${data.name}" p-select="chat-user">
									<label class="checkbox">
										<input class="checkbox__input" name="userCheck" type="checkbox" checked="">
										<span class="checkbox__inner">
											<span class="checkbox__tick"></span>
										</span>
									</label>
									<div class="messages__avatar">
										<img src="${common.isEmpty(data.photo)? '/assets/img/user.png':data.photo}" alt="Avatar">
									</div>
									<div class="messages__details">
										<div class="messages__head">
											<div class="messages__man">${data.name}</div>
										</div>
									</div>
								</div>`;

			$('[p-select="chat-user-list"]').append(tag);
		},

		disconnectUser: (ucode) => {
			$(`[p-select="setting-users"][p-ucode="${ucode}"]`).remove();
			$(`[p-ucode="${ucode}"]`).remove();
		},

		allUsers: async (data) => {
			await documentInit.getAuthority();

			for(let i in data) {
				userInit.setUserTag(data[i]);
				userInit.setChatUserTag(data[i]);
			}

			typpeInit.setUserTyppy();
		}
	}

	let chattingInit = {
		init: () => {
			$('[p-select="chatting-field"]').on('click', function(){
				if(defaultInit.endCheck == true) return customAlert('1091');
			});

			$('#chatMessage').on('keyup', function(e) {
				if(defaultInit.endCheck == true) return customAlert('1091');
				let val = $(this).val();
				if (e.keyCode == 13 && val.replace(/ /g, '') != '') {
					if(val == null || val.trim() == '') return customAlert('1095');
					chattingInit.sendMessage(val, currUserInfo.name);
					$(this).val('');
				}
			});

			$('#chatMessageBtn').on('click', function(){
				if(defaultInit.endCheck == true) return customAlert('1091');
				let val = $('#chatMessage').val();
				if(val == null || val.trim() == '') return customAlert('1095');
				chattingInit.sendMessage(val, currUserInfo.name);
				$('#chatMessage').val('');
			});

			$('.js-popup-chatting').off('showpopup').on('showpopup', function(popup, target){
				$('[p-select="chatting__list"]').scrollTop($('[p-select="chatting__list"]')[0].scrollHeight);
			});

			$('.js-popup-chatting, .js-popup-memo, .js-popup-meeting, .js-popup-vote').on('showpopup', function() {
				$('.main__menu.side__menu.active').removeClass('active')
			});

			$('[p-select="allSelect"]').on('click', function(){
				$('.conference__chatting .messages__list [name=userCheck]').prop('checked', true);
			});

			$('[p-select="selRemove"]').on('click', function(){
				$('.conference__chatting .messages__list [name=userCheck]').prop('checked', false);
			});

			socketInit.io.emit('getChattingList', { confCode: confCode });
		},
		sendMessage: (message, name) => {
			let data = {
				confCode: confCode,
				smp_lang: getCookie('smp_lang'),
				users: [],
				message: message,
				name: name
			};

			let checkedUser = $('[name=userCheck]:checked');
			if(checkedUser.length == 0 ) return customAlert('1095');

			chattingInit.createChatTag({
				type: 'self',
				message: message,
				name: currUserInfo.name
			});

			for (let i = 0, iLen = checkedUser.length; i < iLen; i++) {
				let userUcode = $(checkedUser[i].closest('[p-ucode]')).attr('p-ucode');
				data.users.push(userUcode);
			}
			socketInit.io.emit('sendMessage', data);
		},
		createChatTag: (data) => {
			let type 	= data.type;
			let name 	= data.name;
			let ucode 	= data.ucode;
			let message = data.message;
			let date 	= data.date;
			let photo 	= data.photo;
			let receivers = data.receivers;

			const fallbackTime = conferenceInit?.nowServerTime || Date.now();
			const messageTime = date || fallbackTime;

			let chatTime = moment(messageTime).format("HH:mm a");
			let chatTimeFull = moment(messageTime).format("YYYY/MM/DD HH:mm");

			if(type == 'opponent') {
				//let chatTime = date || moment(messageTime).format("HH:mm a");
				let tag = `<div class="messenger__item" p-chat-ucode="${ucode}">
							<div class="messenger__layer">
								<div class="messenger__avatar"><img src="${photo == null || photo.trim() == '' ? '/assets/img/user.png':photo}" alt="Avatar"></div>
								<div class="messenger__details">
									<div class="messenger__head">
										<div class="messenger__man">${name}</div>
										<div class="messenger__time">${chatTime}</div>
									</div>
									<div class="messenger__content">${message}</div>
								</div>
							</div>
						</div>`;
				$(".conference__chatting .messenger__list").append(tag);

				$("#lastChatTime").text(chatTimeFull);
				$('[p-select="chatting__list"]').scrollTop($('[p-select="chatting__list"]')[0].scrollHeight);
			}else if(type == 'self'){
				//let chatTime = date || moment(messageTime).format("HH:mm a");
				let users = [];

				if(receivers == null) {
					let checkUser = $('[p-select="chat-user"] .checkbox__input:checked');
					checkUser.map(function(i, ele){
						users.push($(ele).closest('[p-select="chat-user"]').attr('p-name'));
					});
					photo = profilePhoto == null || profilePhoto.trim() == '' ? '/assets/img/user.png':profilePhoto;
				}else{
					for(let i in receivers) {
						users.push(receivers[i].name);
					}

					photo = photo || '/assets/img/user.png';
				}

				let tag = `<div class="messenger__item me" p-chat-ucode="${ucode}">
							<div class="messenger__layer">
								<div class="messenger__details">
									<div class="messenger__head">
										<div class="messenger__man">${name}</div>
										<div class="messenger__time">${chatTime}</div>
									</div>
									<div class="messenger__users">${users.join(',')}</div>
									<div class="messenger__content">${message}</div>
								</div>
								<div class="messenger__avatar"><img src="${photo}" alt="Avatar"></div>
							</div>
						</div>`;

				$(".conference__chatting .messenger__list").append(tag);
				$("#lastChatTime").text(chatTimeFull);
				$('[p-select="chatting__list"]').scrollTop($('[p-select="chatting__list"]')[0].scrollHeight);
			}
		}
	}

	window.documentInit = {
		listInterval: null,
		init: () => {
			const extensionMap = ['pdf', 'hwp', 'hwpx', 'show', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'xps', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif']
			$('#document_file').on('change', function() {
				if(defaultInit.endCheck == true) return customAlert('1091');
				let file = $(this)[0].files;

				const formData = new FormData();

				for(let i=0; i< file.length; i++){
					let ext = file[i].name.split('.').pop().toLowerCase();
					if (extensionMap.indexOf(ext) == -1) {
						return customAlert('1061', null, extensionMap.join(', '));
					}
					formData.append('convert_doc_file', file[i]);
					formData.append('type', 'document');
					formData.append('ccode', confCode);

				}

				
				$('.popup__loading').addClass('show');
				
				
				$.ajax({
					beforeSend: beforeSend,
					type: 'POST',
					url: '/files/document/upload',
					processData: false,
					contentType: false,
					data: formData,
					// PROGRESS DOCS
					 xhr: function() {
					 	var xhr = new window.XMLHttpRequest();
						xhr.upload.addEventListener("progress", function(evt) {
					 		if (evt.lengthComputable) {
					 			var percentComplete = evt.loaded / evt.total * 100;
					 			document.getElementById('uploadProgressDocs').textContent = percentComplete.toFixed(1) + '%';
					 		}
					 	}, false);
					 	return xhr;
					 },
					// PROGRESS END
					success: function(data) {
						documentInit.getDocumentList('upload');

						socketInit.io.emit('updateDocumentList', { confCode: confCode });

						$("#document_file").val(null);
						$('.popup__loading').removeClass('show');
					},
					error: function(e) {
						$('.popup__loading').removeClass('show');
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
						}
					}
				});
			});

			$('.js-popup-document').on('showpopup', function(){
				documentInit.getDocumentList('get');
			});

			$('[p-select="createBlackboard"]').on('click', function(){
				if(defaultInit.endCheck == true) return customAlert('1091');
				showPopup($('.js-popup-blackboard'));

				$('[p-select="bb_type1"], [p-select="bb_type2"]').off('click').on('click', function(){
					$('[p-select="bb_type1"], [p-select="bb_type2"]').removeClass('selected');
					$(this).addClass('selected');
				});
			});

			$('#zoomIn').off('click.vn').on('click.vn', function(){
				documentInit.sendPageChange();
			});

			$('#zoomOut').off('click.vn').on('click.vn', function(){
				documentInit.sendPageChange();
			});

			$('[p-select="blackboardSave"]').on('click', function(){
				if(defaultInit.endCheck == true) return customAlert('1091');
				let name = $('[p-select="bb-name"]').val();
				let page = $('[p-select="bb-page"]').val();
				let type = $('[p-select="bb_type1"]').hasClass('selected') == true ? 'type1':'type2';

				if(name == null || name.trim() == '') {
					return customAlert('1018');
				}

				if(page == null || page.trim() == '' || $.isNumeric(page) == false) {
					return customAlert('1080');
				}

				if(Number(page) > 20 || Number(page) < 1) {
					return customAlert('1081', 20);
				}

				$.ajax({
					beforeSend: beforeSend,
					url : '/files/blackboard/create',
					type : 'POST',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						ccode: confCode,
						name: name,
						page: page,
						type: type
					}),
					success: function(data) {
						hidePopup($('.js-popup-blackboard'));
						documentInit.resetBlackboardField();
						documentInit.getDocumentList();
						socketInit.io.emit('updateDocumentList', { confCode: confCode });
					},
					error: function(e) {
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
						}
					}
				});
			});
		},

		getDocumentInterval: (type) => {
			if(documentInit.listInterval != null) {
				clearInterval(documentInit.listInterval);
				documentInit.listInterval = null;
			}
			if(type == 'start') {
				documentInit.listInterval = setInterval(function(){
					if($('[p-select="live-streaming-box"]').is(':visible') == true) return;
					documentInit.getDocumentList();
				}, 1500);
			}
		},

		turnSave: () => {
			let idx = 0;
			let saveMap = [];
			$($('[p-select="document-item"]')).map(function(i, e) {
				$(e).attr('p-turn', idx++);
				let fcode = $(e).attr('p-code');
				saveMap.push(fcode);
			});

			$.ajax({
				beforeSend: beforeSend,
				url : '/files/save/turn',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					confCode: confCode,
					saveMap: saveMap
				}),
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},

		changeScale: () => {
			let scale = PDFViewerApplication.pdfViewer.currentScaleValue;

			if(permissionDoc.indexOf(currUcode) > -1 && conferenceInit.mode.sync == true) {
				let params = {
					zoom:PDFViewerApplication.pdfViewer.currentScaleValue,
					confCode: confCode,
				};
				socketInit.io.emit("changeScale", params);

				//documentInit.setViewerMark();
			}
		},

		setDocumentMouseMark: () => {
			let events = $._data($('.canvasWrapper')[0], 'events');

			if(events == null || events['mousemove'] == null || events['mousemove'][0] == null || events['mousemove'][0]['namespace'] != 'mousemark') {
				$('.canvasWrapper').off('mousemove.mousemark').on('mousemove.mousemark', function(e){
					if(permissionDoc.indexOf(currUcode) > -1) {
						/*console.log("e.offsetX: ", e.offsetX);
						console.log("e.clientX: ", e.clientX);*/

						socketInit.io.emit("documentMouseMark", {
							confCode: confCode,
							x: e.offsetX,
							y:e.offsetY,
							h:$('[p-select="mouse-mark-box"]').height(),
							w:$('[p-select="mouse-mark-box"]').width()
						});
					}
				});
			}
			if(events == null || events['click'] == null || events['click'][0] == null || events['click'][0]['namespace'] != 'mousemark') {
				$('.canvasWrapper').off('click.mousemark').on('click.mousemark', function(e){
					if(permissionDoc.indexOf(currUcode) > -1) {
						socketInit.io.emit("documentMouseMark", {confCode: confCode, click: true});
					}
				});
			}
		},

		setDocumentMouseMarkShowHide: (type) => {
			if(permissionDoc.indexOf(currUcode) > -1) {
				return $('[p-select="mouse-mark"]').hide();
			}
			if(type == 'show') {
				$('[p-select="mouse-mark"]').show();
			}else if(type == 'hide'){
				$('[p-select="mouse-mark"]').hide();
			}
		},

		setDocumentMouseMarkPosition: (data) => {
			if(permissionDoc.indexOf(currUcode) == -1) {
				let c = data.click;

				if(c == true) {
					$('[p-select="mouse-mark"]').addClass('clickEffect');
					$('[p-select="mouse-mark"]')[0].addEventListener('animationend', function(){
						$('[p-select="mouse-mark"]').removeClass('clickEffect');
					}.bind(this));
				}else{
					let w = data.w;
					let h = data.h;
					let x = data.x;
					let y = data.y;
					let tw = $('[p-select="mouse-mark-box"]').width();
					let th = $('[p-select="mouse-mark-box"]').height();
					let per = tw/w*100;

					if(w > tw) {
						x = x - (x*(1-per/100));
						y = y - (y*(1-per/100));
					}else if(w < tw){
						x = (x*(1+per/100)) - x;
						y = (y*(1+per/100)) - y;
					}
					//console.log("::", x, y, per);
					$('[p-select="mouse-mark"]').css({
						top: `${y-2}px`, // 포인트 크기만큼 마이너스
						left: `${x-8}px`
					});
				}
			}
		},

		setViewerMark: () => {
			if($('.canvasWrapper').offset() == null) return;
			let cw = $('.canvasWrapper').width();
			let ch = $('.canvasWrapper').height();
			let cl = $('.canvasWrapper').offset().left;
			let mh = $('#viewerContainer').height();

			if(cl <= 30) {
				cl = $('[p-select="viewer-mark-icon"]').height()+20;
			}

			$('[p-select="viewer-mark-layer"]').css({
				'height':`${ch}px`,
				'max-height': `${mh}px`
			});
			$('[p-select="viewer-mark"]').css({
				'left':`${cl}px`
			});

			setTimeout(function(){
				let gap = $('[p-select="viewer-mark-icon"]').height();

				$('#viewer .page').off('mousemove.mark').on('mousemove.mark', function(e){
					if(conferenceInit.mode.pointer != true) return;
					if($('[blackboard-mode="true"]').length == 0) {
						// 76 = header height
						let top = e.pageY-76-(gap/2);
						$('[p-select="viewer-mark-icon"]').css({
							'top': `${top}px`
						});

						if(permissionDoc.indexOf(currUcode) > -1) {
							let st = $('#viewerContainer').scrollTop();
							socketInit.io.emit("moveViewMark", {confCode: confCode, wh: $(window).height(), vh: $('#viewer').height(), top: top, st: st});
						}
					}
				});
			}, 100)
		},

		setMarkPosition: (data) => {
			const vh = data.vh;   //presenter - view 높이
			const top = data.top; //presenter - mark top
			const st = data.st;   //presenter - scroll top
			const wh = data.wh;   //presenter - window height

			const lvh = $('#viewer').height();
			const lst = $('#viewerContainer').scrollTop();
			const lwh = $(window).height();

			let sgap = 0; //persenter과 viewer의 스크롤 차이

			let per = lvh/vh*100;
			let sum = 0;

			if(per >= 100) {
				per = per - 100;
				sum = top*(1+per/100);
			}else{
				per = 100-per;
				sum = top*(1-per/100);
			}

			if(wh < lwh) {
				sgap = st - lst;
				sum = sum + sgap;
			}

			$('[p-select="viewer-mark-icon"]').css({
				'top': `${sum}px`
			});

			$('#viewer .page').off('mousemove.mark');
		},

		sendPageChange: (type) => {
			if(permissionDoc.indexOf(currUcode) > -1) {
				let params = {
					zoom:PDFViewerApplication.pdfViewer.currentScaleValue,
					confCode: confCode,
					page: PDFViewerApplication.page,
					pdf: PDFViewerApplication.baseUrl.replace('/pdfs/', ''),
					t: $('#viewerContainer').scrollTop(),
					vh: $('#viewer').height(),
					type: type
				};
				socketInit.io.emit("sendPageChange", params);
			}
		},

		resetBlackboardField: () => {
			$('[p-select="bb-name"]').val('');
			$('[p-select="bb-page"]').val('1');
			$('.bb__type1').addClass('selected');
			$('.bb__type2').removeClass('selected');
		},

		getAuthority: () => {
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/getAuth',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode
				}),
				success: function(data) {
					let result = data.result;
					permissionDoc = result.permission_doc || [];
					permissionVoc = result.permission_voc || [];

					if(permissionDoc.indexOf(currUcode) > -1) {
						$('.user__btn').hide();
						$('.presenter__btn').show();
					}else{
						$('.user__btn').show();
						$('.presenter__btn').hide();
					}

					conferenceInit.setSyncButton();

					deferred.resolve();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
			return deferred.promise();
		},

		getDocumentList: (type, callback) => {
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/files/document/list',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode
				}),
				success: function(data) {
					let result = data.result;
					let pdf = null;

					if(callback != null) return callback(data);
					$('.js-popup-document .document__item').remove();
					$('[p-select="document-list"]').off('change.doclist').empty();
					$('[p-select="document-delete"]').off('click');

					for (let i of result) {
						if (pdf == null) pdf = i['pdfFileName'];

						documentInit.setDocumentList(i);
						
						let selected = '';

						if(PDFViewerApplication.baseUrl != null && PDFViewerApplication.baseUrl != '' && PDFViewerApplication.baseUrl.indexOf(i.pdfFileName) > -1) {
							selected = ' selected="selected"';
						}
						let lang = getCookie('smp_lang') || 'kr';
						let statusMsg = currUserInfo.message['2069'][lang];

						if(i.status == 'running') statusMsg = currUserInfo.message['2070'][lang];
						if(i.status == 'complete') statusMsg = currUserInfo.message['2071'][lang];
						if(i.status == 'error') statusMsg = currUserInfo.message['2072'][lang];

						$('[p-select="document-list"]').append(`<option p-status="${i.status}" value="${i.pdfFileName}"${selected}>${i.originalname}</option>`);
						// [${statusMsg}]
					}

					$('.document__item').parent().sortable({
						axis: 'y',
						animation: 1,
						items: ".customer__row.document__item",
						handle: "[p-select='document-turn-btn']",
						start: function() {
							documentInit.getDocumentInterval('stop');
						},
						stop : function(ev, ui) {
							documentInit.turnSave();
							documentInit.getDocumentInterval('start');
					    }
					});

					if(result.length == 0) {
						$('[p-select="document-list"]').append(`<option p-value="noDocument" value="null"></option>`);
						$('[p-select="document-list"]').attr('disabled', 'disabled');
					}else{
						$('[p-select="document-list"]').removeAttr('disabled');
					}

					$('[p-select="document-list"]').niceSelect('update');
					$('[p-select="document-list"]').on('change.doclist', function(e){
						if($(this).find('option:selected').attr('p-status') != null && $(this).find('option:selected').attr('p-status') != 'complete') return customAlert('2073');
						if(conferenceInit.mode.seminar == true && permissionDoc.indexOf(currUcode) == -1 && $(document.activeElement).hasClass('nice-select') == true) {
							$('[p-select="document-list"]').val(presenterInfo.pdf).niceSelect('update');
							return customAlert('1099');
						}

						if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.sync == true && $(document.activeElement).hasClass('nice-select') == true) {
							defaultInit.userSyncToggle();
						}
						
						let pdf = $(this).val();
						if($('[p-select="document-list"]').data('firstLoad') == 'true') {
							documentInit.changePdf(pdf, 1, false);
							$('[p-select="document-list"]').data('firstLoad', null)
						}else{
							documentInit.changePdf(pdf);
						}

						if(permissionDoc.indexOf(currUcode) > -1) {
							setTimeout(function(){
								socketInit.io.emit('setUserSyncSetting', {confCode: confCode});
								defaultInit.setDefaultMode();
								conferenceInit.setStatus({sync: true});
							}, 3000)
						}
					});

					$('[p-select="document-item"] [p-select="document-item-name"]').on('click', function(e){
						if($(this).closest('[p-select="document-item"]').attr('p-status') != 'complete') return customAlert('2073');

						if($(e.target).hasClass('del-btn') == false) {
							let pdf = $(this).attr('p-data');
							console.log('pdf', pdf);
							if(pdf == null) pdf = $(this).closest('.customer__row').attr('p-data');
							
			                documentInit.changePdf(pdf);
			                hidePopup($('.js-popup-document'));

			                $('[p-select="document-list"]').val(pdf).niceSelect('update');

							if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.sync == true) {
								defaultInit.userSyncToggle();
							}

							if(permissionDoc.indexOf(currUcode) > -1) {
								setTimeout(function(){
									socketInit.io.emit('setUserSyncSetting', {confCode: confCode});
									defaultInit.setDefaultMode();
									conferenceInit.setStatus({sync: true});
								}, 3000)
							}
						}
		            });

					$('[p-select="document-delete"]').on('click', function(){
						// if($(this).closest('[p-select="document-item"]').attr('p-status') != 'complete') return customAlert('2074');

		                let fcode = $(this).attr('p-data');
		                let ccode = $(this).attr('p-ccode');
		                documentInit.deleteDocument(ccode, fcode);
		            });

		            deferred.resolve();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
			return deferred.promise();
		},

		setDocumentRequest: (userUcode) => {
			socketInit.io.emit('requestPresenter', {confCode:confCode, userUcode:userUcode, type: 'document'});
			typpeInit.hideAllTyppy();
			alarmInit.showToast(_spl('requsetedDoc'), 'bottom-right', 'info');
		},

		setDocumentList: (data) => {
			let documentInitChangePdf = documentInit.changePdf;
			let lang = getCookie('smp_lang') || 'kr';

			let statusMsg = currUserInfo.message['2069'][lang];
			let errorMsg = '';
			
			if(data.status == 'running') statusMsg = currUserInfo.message['2070'][lang];
			if(data.status == 'complete') statusMsg = currUserInfo.message['2071'][lang];
			if(data.status == 'error') {
				statusMsg = currUserInfo.message['2072'][lang];

				switch(data.errorCode) {
					case "error_f1" :
						errorMsg = ` | ${currUserInfo.message['1042'][lang]}`;
						break;
			        case "error_f2" :
			        	errorMsg = ` | ${currUserInfo.message['1043'][lang]}`;
			        	break;
			        case "error_f3" :
			        	errorMsg = ` | ${currUserInfo.message['1044'][lang]}`;
			        	break;
			        case "error_d1" :
			        	errorMsg = ` | ${currUserInfo.message['1012'][lang]}`;
			        	break;
	        		case "error_d2" :
	        			errorMsg = ` | ${currUserInfo.message['1045'][lang]}`;
	        			break;
				}
			}

			let tag = `<div class="customer__row document__item" p-status="${data.status}" p-data="${data.pdfFileName}" p-code="${data.fcode}" p-select="document-item">
								<div class="customer__col dis__none"></div>
								<div class="customer__col" p-select="document-item-name">
									<div class="customer__item">
										<div class="customer__description">
											<div>${data.originalname}</div>
										</div>
									</div>

									<div class="customer__item convert-info not__hover">
							            <span>${statusMsg}${errorMsg}</span>
							        </div>

								</div>
								<div class="customer__col" p-select="document-item-date">
									<div class="customer__item not__hover">
										<div class="customer__description">
											<div>${moment(data.create_at).format('YY.MM.DD<br />HH:mm')}</div>
										</div>
									</div>
								</div>
								<div class="customer__col">
									<div class="customer__item not__hover">
										<div class="customer__description">
											<div>${data.name || data?.user?.name}</div>
										</div>
									</div>
								</div>
								<div class="customer__col del-btn">
			                        <div class="schedule__control del-btn">
			                            <button type="button" class="schedule__button del-btn" p-select="document-delete" p-ccode="${data.ccode}" p-data="${data.fcode}">
			                                <svg class="icon icon-trash del-btn">
			                                    <use xlink:href="#icon-trash" class="del-btn"></use>
			                                </svg>
			                            </button>
			                        </div>
			                    </div>
			                    <div class="customer__col turn-btn">
			                    	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" p-select="document-turn-btn">
			                            <path d="M11.5 2.666c.368 0 .667.298.667.667h0v8.057l1.529-1.529c.26-.26.682-.26.943 0s.26.682 0 .943h0L12.443 13c-.521.521-1.365.521-1.886 0h0l-2.195-2.195c-.26-.26-.26-.682 0-.943s.682-.26.943 0h0l1.529 1.529V3.333c0-.368.298-.667.667-.667zM5.776 3l2.195 2.195c.26.26.26.682 0 .943s-.682.26-.943 0L5.5 4.609v8.057c0 .368-.298.667-.667.667s-.667-.298-.667-.667V4.609L2.638 6.138c-.26.26-.682.26-.943 0s-.26-.682 0-.943L3.891 3c.521-.521 1.365-.521 1.886 0z"></path>
			                        </svg>
			                    </div>
							</div>`;
			$('.js-popup-document .customer__table').append(tag);
		},

		deleteDocument: async (ccode, fcode) => {
		    let confirm = await customConfirm('1041');

		    if(confirm == true) {
		        $.ajax({
		        	beforeSend: beforeSend,
		        type: 'POST',
		        url: '/files/document/remove',
		        contentType: 'application/json; charset=utf-8',
		        data: JSON.stringify({
		            ccode: ccode,
		            fcode: fcode
		        }),
		        success: function(data) {
		        	const  result = data.result;
		        	if(PDFViewerApplication.baseUrl != null && PDFViewerApplication.baseUrl.indexOf(result.filename) > -1) {
		        		PDFViewerApplication.close();
		        	}
		            documentInit.getDocumentList(ccode);
		            bookmarkInit.getBookmarkList();
		            socketInit.io.emit('updateDocumentList', { confCode: confCode, type: 'delete', filename:result.filename });
		        },
		        error: function(e) {
		        	if(e?.responseJSON?.errorCode == 'auth_failed') {
		        		customAlert('1098');
		        		parent.location.href = '/';
		        	}
		            let message = e?.responseJSON?.message;
		            if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
		            else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						return alert(message);
		            	// window.loc = true;
		            	// return location.href='/';
		            }
		        }
		    })
		    }
		},

		setPageMode: () => {
			if(conferenceInit.mode.blackboard == true) {
				PDFViewerApplication.pdfViewer.scrollMode = 3;
				whiteboardInit.setDraw();
			}else{
				//PDFViewerApplication.pdfViewer.scrollMode = 0;
				PDFViewerApplication.pdfViewer.scrollMode = 3;
			}
		},

		setPdf: async (params) => {

			let type = params.type;
			let currPage = params.currPage;
			let callback = params.callback;
			let zoom = params.zoom;
			let pdf = params.pdf;

			if(type == 'change') {
				if(conferenceInit.mode.type == 'first' && currPage != conferenceInit.mode.page && conferenceInit.mode.sync == true) {
					PDFViewerApplication.page = conferenceInit.mode.page;
				}else{
					PDFViewerApplication.page = currPage;
				}

				let pagechangingBindCheck = true;
				try{
					for(let i=0; i<PDFViewerApplication.eventBus._listeners.pagechanging.length; i++){
						if(PDFViewerApplication.eventBus._listeners.pagechanging[i]['external'] == true) {
							pagechangingBindCheck = false;
							break;
						}
					}
				}catch(e){}

				if(pagechangingBindCheck == true) {
					PDFViewerApplication.eventBus.on('pagechanging', function pagechange(evt) {
						if( permissionDoc.indexOf(currUcode) > -1) {
							conferenceInit.mode.page = evt.pageNumber;
						}
						documentInit.sendPageChange();
						documentInit.setPageMode();

						defaultInit.userActionBind();

						whiteboardInit.setSize();

						if(callback != null) callback();

						$('[p-select="util-pages"]').text(PDFViewerApplication.pagesCount);
						$('[p-select="util-page"]').val(PDFViewerApplication.page);
					});

					PDFViewerApplication.eventBus.on('pagesloaded', function pagechange(evt) {
						if( permissionDoc.indexOf(currUcode) > -1) {
							conferenceInit.mode.page = currPage;
						}
						documentInit.sendPageChange();
						documentInit.setPageMode();

						defaultInit.userActionBind();

						whiteboardInit.setSize();
						if(callback != null) callback();

						$('[p-select="util-pages"]').text(PDFViewerApplication.pagesCount);
						$('[p-select="util-page"]').val(PDFViewerApplication.page);
					});

					PDFViewerApplication.eventBus.on('zoomchange', function pagechange(evt) {
						whiteboardInit.setCanvasSize();

						if(window.zoomchange != null) clearTimeout(window.zoomchange);
						window.zoomchange = setTimeout(function(){
							whiteboardInit.setSize();
							documentInit.changeScale();
						}, 500);
						if(callback != null) callback();

						defaultInit.userSyncToggle();
					});

					$('#scaleSelect').on('change', function(){
						whiteboardInit.setCanvasSize();

					    whiteboardInit.setSize();
					    documentInit.changeScale();

					    defaultInit.userSyncToggle();
					});
				}
				documentInit.sendPageChange();
				documentInit.setPageMode();
				await whiteboardInit.setDraw();
				defaultInit.userActionBind();
				whiteboardInit.setSize();
				$('[p-select="conf-loading2"]').hide();
				if(callback != null) callback();
				$('[p-select="util-pages"]').text(PDFViewerApplication.pagesCount);
				$('[p-select="util-page"]').val(PDFViewerApplication.page);
			}else{
				let data = params.data;

				PDFViewerApplication.pdfViewer.currentScaleValue = zoom || defaultZoom;
				if(PDFViewerApplication.page != currPage) {
					PDFViewerApplication.page = currPage;
				}

				setTimeout(function(){
					var t = data.t;
					var h = data.vh;
					var vh = $('#viewer').height();

					var s1 = vh/h*100;
					var s2 = t*s1/100;

					$('#viewerContainer').scrollTop(s2);

					setTimeout(function(){
						$('#viewerContainer').removeData('removeScroll');
					}, 500);
				}, 400);

				if(conferenceInit.mode.blackboard == true) {
					whiteboardInit.setDraw();
				}
				
				$('[p-select="document-list"]').val(pdf).niceSelect('update');
			}
		},

		changePdf: (pdf, page, sendFlag = true, callback) => {
			if(pdf == null || pdf == 'undefined') return;
			
			$('[p-select="conf-loading2"]').show();
			$('[p-select="loading-message2"]').text(currUserInfo?.message?.pvalue?.loadPDF[getCookie('smp_lang')]);

			let currPage = parseInt(page != null ? page : 1);
			if( permissionDoc.indexOf(currUcode) > -1 && sendFlag != false && conferenceInit.mode.sync == true) {
				$('[p-select="document-list"]').val(pdf).niceSelect('update');
				conferenceInit.mode.pdf = pdf;
				socketInit.io.emit('changePdf', {pdf: pdf, confCode: confCode});
			}
			if(pdf == null || pdf == 'null') {
				$('[p-select="conf-loading2"]').hide();
				return;
			}
			try{ 
				if(PDFViewerApplication.baseUrl != `/pdfs/${pdf}`) {
					PDFViewerApplication.pdfViewer.textLayerMode = 0;
					PDFViewerApplication.preferences.set('sidebarViewOnLoad', 0);

					PDFViewerApplication.open('/pdfs/' + pdf).then(function() {
						PDFViewerApplication.pdfViewer.currentScaleValue = defaultZoom;
						setTimeout(function(){
							documentInit.setPdf({type: "change", currPage: currPage, callback: callback, pdf: pdf});
						}, 400);
					}).catch(function(e){
						customAlert('2077');
						$('[p-select="conf-loading2"]').hide();
					});
				}else{
					documentInit.setPdf({type: "change", currPage: currPage, callback: callback, pdf: pdf});
				}
			}catch(e){
				$('[p-select="conf-loading2"]').hide();
			}
		}
	}

	let memoInit = {
		init: () => {

			$('[p-select="memo-field"]').on('click', function(e){
				if($(e.target).hasClass('js-popup-close') == false && defaultInit.endCheck == true) return customAlert('1091');
			});

			$('.js-popup-memo').off('showpopup').on('showpopup', function(popup, target){
				memoInit.getMemoList();
			});

			$('.js-popup-memo').off('hidepopup').on('hidepopup', function(popup, target){
				memoInit.resetMemo();
			});

			$('[p-select="saveMemo"]').on('click', function() {
				if(defaultInit.endCheck == true) return customAlert('1091');

				let content = $('[p-select="memoContent"]').val();
				let title = $('[p-select="memoTitle"]').val();
				let extractTextPattern = /(<([^>]+)>)/gi;
				let content_str = content.replace(extractTextPattern, '');

				if(title == null || title.trim() == '') {
					return customAlert('1018');
				}

				if(content_str == null || content_str == '') {
					return customAlert('1030');
				}
				memoInit.createMemo({
					content: content,
					title: title
				});
			});

			$('[p-select="createMemo"]').on('click', function() {
				memoInit.resetMemo();
			});
		},

		createMemo: (data) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/createMemo',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					content: data.content,
					title: data.title
				}),
				success: function(data) {
					customAlert('1031');
					memoInit.resetMemo();
					memoInit.getMemoList();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},

		resetMemo: () => {
			$('[p-select="memoTitle"]').val('');
			$('[p-select="memoTitle"]').removeAttr('readonly');
			$('[p-select="memoContent"]').val('').trigger('change');

			$('[p-select="memoContentLayer"] .richText-editor').attr('contenteditable', 'true');
			$('[p-select="saveMemo"]').show();
			$('[p-select="createMemo"]').hide();
			$('[p-select="cancelMemoPopup"]').removeClass('wp__100');
			$('[p-select="memo-item"]').removeClass('active');
		},

		getMemoList: () => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/getMemoList',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode
				}),
				success: function(data) {
					let result = data.result;
					$('.conference__memo .messages__list').empty();

					for(let i of result) {
						let tag = `<div class="messages__item new" p-select="memo-item" p-mcode="${i.mcode}">
										<div class="messages__details">
											<div class="messages__head">
												<div class="messages__man">${i.title}</div>
											</div>
										</div>
									</div>`;
						let item = $(tag).appendTo('.conference__memo .messages__list');

						if(i.ucode == currUcode) {
							item.find('.messages__details').append(`<div class="schedule__control memo-field-item">
																		<button type="button" class="schedule__button" p-data="${i.mcode}">
																			<svg class="icon icon-trash">
																				<use xlink:href="#icon-trash"></use>
																			</svg>
																		</button>
																	</div>`);
						}
					}

					$('[p-select="memo-item"]').on('click', function(){
						memoInit.setMemoDetail($(this).attr('p-mcode'), this)
					});

					$('.conference__memo .messages__list .schedule__button').off('click').on('click', async function(e){
						e.stopPropagation();
						let mcode = $(this).attr('p-data');
						let confirm = await customConfirm('1041');

						if(confirm == true) {
							memoInit.removeMemo(mcode);
						}
					});
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		removeMemo: (mcode) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/removeMemo',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					mcode: mcode
				}),
				success: function(data) {
					memoInit.resetMemo();
					memoInit.getMemoList();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		setMemoDetail: (mcode, th) => {
			$('[p-select="memo-item"]').removeClass('active');
			$(th).addClass('active');

			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/getMemoDetail',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					mcode: mcode
				}),
				success: function(data) {
					let result = data.result;
					$('[p-select="memoTitle"]').val(result.title);
					$('[p-select="memoTitle"]').attr('readonly', 'readonly')
					$('[p-select="memoContent"]').val(result.content).trigger('change');

					$('[p-select="memoContentLayer"] .richText-editor').removeAttr('contenteditable');
					$('[p-select="saveMemo"]').hide();
					$('[p-select="createMemo"]').show();
					$('[p-select="cancelMemoPopup"]').addClass('wp__100');
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		}
	};

	let minutesInit = {
		seletMinutes: null,
		init: async () => {
			$('.js-popup-minutes').off('showpopup').on('showpopup', function(popup, target){
				minutesInit.getMinutesList();
			});

			$('.js-popup-minutes').off('hidepopup').on('hidepopup', function(popup, target){
				minutesInit.resetMinutesField();
			});

			$('[p-select="minutes-save"]').on('click', function() {
				if(defaultInit.endCheck == true) return customAlert('1091');
				minutesInit.saveMinutes();
			});

			$('[p-select="minutes-create"]').on('click', function() {
				minutesInit.resetMinutesField();
			});

			$('[p-select="save-minutes"]').on('click', function() {
				minutesInit.saveMinutesPdf();
			});

			minutesInit.resetMinutesField();

			common.setTagify(conferenceInit.participant, '[p-select="minutesParticipant"]');
			common.setTagify(conferenceInit.participant, '[p-select="minutesAttendees"]');
			common.setTagify(conferenceInit.participant, '[p-select="minutesNoneAttendees"]');
		},

		resetMinutesField: () => {
			minutesInit.seletMinutes = null;
			$('[p-select=minutesWriteDate]').val(moment().format('YYYY-MM-DD HH:00'));
			$('[p-select=minutesDate]').val(moment().format('YYYY-MM-DD HH:00'));
			$('[p-select=minutesDepartment]').val('');
			$('[p-select=minutesWriter]').val(name);
			try{$('[p-select=minutesParticipant]')[0].tagify.removeAllTags();}catch(e){}
			try{$('[p-select=minutesAttendees]')[0].tagify.removeAllTags();}catch(e){}
			try{$('[p-select=minutesNoneAttendees]')[0].tagify.removeAllTags();}catch(e){}
			$('[p-select=minutesAgenda]').val('');
			$('[p-select=minutesContent]').val('').trigger('change');
			$('[p-select=minutesNote]').val('');
			$('.minutes__item').removeClass('active');
			minutesInit.setReadonlyMinutesField();
		},

		setReadonlyMinutesField: (type) => {
			if(type == 'readonly') {
				$('[p-select="minutesWriteDate"]').off('click').attr('readonly', 'readonly');
				$('[p-select=minutesDate]').off('click').attr('readonly', 'readonly');
				$('[p-select=minutesDepartment]').attr('readonly', 'readonly');
				$('[p-select=minutesWriter]').attr('readonly', 'readonly');
				try{$('[p-select=minutesParticipant]')[0].tagify.setReadonly('on');}catch(e){}
				try{$('[p-select=minutesAttendees]')[0].tagify.setReadonly('on');}catch(e){}
				try{$('[p-select=minutesNoneAttendees]')[0].tagify.setReadonly('on');}catch(e){}
				$('[p-select=minutesAgenda]').attr('readonly', 'readonly');
				$('[p-select="minutesFieldset"] .richText-editor').removeAttr('contenteditable');
				$('[p-select=minutesNote]').attr('readonly', 'readonly');
				$('[p-select="munutesStatus"]').prop('disabled', true).niceSelect('update');
			}else{
				dataPopupBind();
				$('[p-select=minutesDepartment]').removeAttr('readonly');
				$('[p-select=minutesWriter]').removeAttr('readonly');
				try{$('[p-select=minutesParticipant]')[0].tagify.setReadonly(null);}catch(e){}
				try{$('[p-select=minutesAttendees]')[0].tagify.setReadonly(null);}catch(e){}
				try{$('[p-select=minutesNoneAttendees]')[0].tagify.setReadonly(null);}catch(e){}
				$('[p-select=minutesAgenda]').removeAttr('readonly');
				$('[p-select="minutesFieldset"] .richText-editor').attr('contenteditable', true);
				$('[p-select=minutesNote]').removeAttr('readonly');
				$('[p-select="munutesStatus"]').removeAttr('disabled').niceSelect('update');
			}
		},

		getMinutesList: () => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/getMinutesList',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode
				}),
				success: function(data) {
					let result = data.result;
					minutesInit.setMinutesList(result);
				}
			});
		},

		setMinutesList: (data) => {
			$('.conference__minutes .messages__list').empty();

			for(let i of data) {
				let status = i.status;
				let agenda = i.agenda;
				let writer = i.writer;
				let mcode  = i.mcode;

				let tag = `<div class="messages__item minutes__item" p-select="minutes-item" p-mcode="${mcode}">
								<div class="status__round${status == 0?'':' blue'}">${status == 0 ? _spl('creating'):(_spl('creation')+'<br />'+_spl('complete'))}</div>
								<div class="messages__details">
									<div class="messages__head">
										<div class="messages__man">${agenda}</div>
									</div>
									<div class="messages__content">${writer}</div>
								</div>
								<div class="schedule__control">
									<button type="button" class="schedule__button">
										<svg class="icon icon-trash">
											<use xlink:href="#icon-trash"></use>
										</svg>
									</button>
								</div>
							</div>`;
				$('.conference__minutes .messages__list').append(tag);
			}

			$('[p-select="minutes-item"]').on('click', function(){
				const mcode = $(this).attr('p-mcode');
				minutesInit.getMinutesDetail(mcode, this);
			});
		},

		getMinutesDetail: (mcode, th) => {
			$('.minutes__item').removeClass('active');
			$(th).addClass('active');

			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/getMinutesDetail',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					mcode: mcode
				}),
				success: function(data) {
					let result = data.result;
					minutesInit.setMinutesDetail(result);
					minutesInit.seletMinutes = result.mcode;
				}
			});
		},

		setMinutesDetail: (data) => {
			minutesInit.resetMinutesField();

			$('[p-select=minutesWriteDate]').val(moment(data.write_date).format('YYYY-MM-DD HH:mm'));
			$('[p-select=minutesDate]').val(moment(data.date).format('YYYY-MM-DD HH:mm'));

			$('[p-select=minutesDepartment]').val(data.department);
			$('[p-select=minutesWriter]').val(data.writer);

			$('[p-select=minutesParticipant]')[0].tagify.addTags(data.participant);
			$('[p-select=minutesAttendees]')[0].tagify.addTags(data.attendees);
			$('[p-select=minutesNoneAttendees]')[0].tagify.addTags(data.none_attendees);

			$('[p-select=minutesAgenda]').val(data.agenda);
			$('[p-select=minutesContent]').val(data.contents).trigger('change');
			$('[p-select=minutesNote]').val(data.anything);

			if(data.ucode == currUcode) {
				minutesInit.setReadonlyMinutesField();
			}else{
				minutesInit.setReadonlyMinutesField('readonly');
			}
		},

		saveMinutes: async () => {
			let confirm = await customConfirm('1032');

			if(confirm == true) {
				let minutesWriteDate = $('[p-select=minutesWriteDate]').val();
				let minutesDate = $('[p-select=minutesDate]').val();

				let minutesDepartment = $('[p-select=minutesDepartment]').val();
				let minutesWriter = $('[p-select=minutesWriter]').val();

				let minutesParticipant = $('[p-select=minutesParticipant]').val();
				let minutesAttendees = $('[p-select=minutesAttendees]').val();
				let minutesNoneAttendees = $('[p-select=minutesNoneAttendees]').val();

				let minutesParticipantArr = [];
				let minutesAttendeesArr = [];
				let minutesNoneAttendeesArr = [];

				let minutesAgenda = $('[p-select=minutesAgenda]').val();
				let minutesContent = $('[p-select=minutesContent]').val();
				let minutesNote = $('[p-select=minutesNote]').val();

				let munutesStatus = $('[p-select="munutesStatus"]').val();

				let extractTextPattern = /(<([^>]+)>)/gi;
				let minutesContentStr = minutesContent.replace(extractTextPattern, '');

				if(minutesWriteDate == null || moment(minutesWriteDate, 'YYYY-MM-DD HH:mm').isValid() == false) {
					return customAlert('1033');
				}

				if(minutesDate == null || moment(minutesDate, 'YYYY-MM-DD HH:mm').isValid() == false) {
					return customAlert('1034');
				}

				if(minutesDepartment == null || minutesDepartment.trim() == '') {
					return customAlert('1035');
				}

				if(minutesWriter == null || minutesWriter.trim() == '') {
					return customAlert('1036');
				}

				if(minutesAgenda == null || minutesAgenda.trim() == '') {
					return customAlert('1037');
				}

				if(minutesContentStr == null || minutesContentStr.trim() == '') {
					return customAlert('1038');
				}

				try{
					minutesParticipant = JSON.parse(minutesParticipant);

					for(let i of minutesParticipant) {
						minutesParticipantArr.push(i.value);
					}
				}catch(e){}

				try{
					minutesAttendees = JSON.parse(minutesAttendees);

					for(let i of minutesAttendees) {
						minutesAttendeesArr.push(i.value);
					}
				}catch(e){}

				try{
					minutesNoneAttendees = JSON.parse(minutesNoneAttendees);

					for(let i of minutesNoneAttendees) {
						minutesNoneAttendeesArr.push(i.value);
					}
				}catch(e){}

				$.ajax({
					beforeSend: beforeSend,
					url : '/conference/saveMinutes',
					type : 'POST',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						mcode: minutesInit.seletMinutes,
						ccode: confCode,
						minutesWriteDate: minutesWriteDate,
						minutesDate: minutesDate,
						minutesDepartment: minutesDepartment,
						minutesWriter: minutesWriter,
						minutesParticipant: minutesParticipantArr,
						minutesAttendees: minutesAttendeesArr,
						minutesNoneAttendees: minutesNoneAttendeesArr,
						minutesAgenda: minutesAgenda,
						minutesContent: minutesContent,
						minutesNote: minutesNote,
						munutesStatus: munutesStatus
					}),
					success: function(data) {
						minutesInit.getMinutesList();
						if(minutesInit.seletMinutes == null){
							minutesInit.resetMinutesField();
						}
					},
					error: function(e) {
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
					}
					}
				});
			}
		},

		saveMinutesPdf: () => {

			if($('[p-select="save-minutes"]').attr('running') == 'true') {
				return customAlert('1040');
			}

			$('[p-select="save-minutes"]').text(_spl('saving'));
			$('[p-select="save-minutes"]').attr('running', 'true');

			let minutesWriteDate = $('[p-select=minutesWriteDate]').val();
			let minutesDate = $('[p-select=minutesDate]').val();

			let minutesDepartment = $('[p-select=minutesDepartment]').val();
			let minutesWriter = $('[p-select=minutesWriter]').val();

			let minutesParticipant = $('[p-select=minutesParticipant]').val();
			let minutesAttendees = $('[p-select=minutesAttendees]').val();
			let minutesNoneAttendees = $('[p-select=minutesNoneAttendees]').val();

			let minutesParticipantArr = [];
			let minutesAttendeesArr = [];
			let minutesNoneAttendeesArr = [];

			let minutesAgenda = $('[p-select=minutesAgenda]').val();
			let minutesContent = $('[p-select=minutesContent]').val();
			let minutesNote = $('[p-select=minutesNote]').val();

			let munutesStatus = $('[p-select="munutesStatus"]').val();

			let extractTextPattern = /(<([^>]+)>)/gi;
			let minutesContentStr = minutesContent.replace(extractTextPattern, '');

			try{
				minutesParticipant = JSON.parse(minutesParticipant);

				for(let i of minutesParticipant) {
					minutesParticipantArr.push(i.name);
				}
			}catch(e){
				$('[p-select="save-minutes"]').text(_spl('savePrintPdf'));
				$('[p-select="save-minutes"]').removeAttr('running');
			}

			try{
				minutesAttendees = JSON.parse(minutesAttendees);

				for(let i of minutesAttendees) {
					minutesAttendeesArr.push(i.name);
				}
			}catch(e){
				$('[p-select="save-minutes"]').text(_spl('savePrintPdf'));
				$('[p-select="save-minutes"]').removeAttr('running');
			}

			try{
				minutesNoneAttendees = JSON.parse(minutesNoneAttendees);

				for(let i of minutesNoneAttendees) {
					minutesNoneAttendeesArr.push(i.name);
				}
			}catch(e){
				$('[p-select="save-minutes"]').text(_spl('savePrintPdf'));
				$('[p-select="save-minutes"]').removeAttr('running');
			}

			$('[p-select="printMinutesWriteDate"]').text(minutesWriteDate);
			$('[p-select="printMinutesDate"]').text(minutesDate);
			$('[p-select="printMinutesDepartment"]').text(minutesDepartment);
			$('[p-select="printMinutesWriter"]').text(minutesWriter);
			$('[p-select="printMinutesParticipant"]').text(minutesParticipantArr.join(', '));
			$('[p-select="printMinutesAttendees"]').text(minutesAttendeesArr.join(', '));
			$('[p-select="printMinutesNoneAttendees"]').text(minutesNoneAttendeesArr.join(', '));
			$('[p-select="printMinutesAgenda"]').text(minutesAgenda);
			$('[p-select="printMinutesContent"]').html(minutesContent);
			$('[p-select="printMinutesNote"]').text(minutesNote);
			$('.report__form').show();
			$(".report__form").printThis({
				afterPrint: function(){
					$('[p-select="save-minutes"]').text(_spl('savePrintPdf'));
					$('[p-select="save-minutes"]').removeAttr('running');

					$('[p-select="printMinutesWriteDate"]').text('');
					$('[p-select="printMinutesDate"]').text('');
					$('[p-select="printMinutesDepartment"]').text('');
					$('[p-select="printMinutesWriter"]').text('');
					$('[p-select="printMinutesParticipant"]').text('');
					$('[p-select="printMinutesAttendees"]').text('');
					$('[p-select="printMinutesNoneAttendees"]').text('');
					$('[p-select="printMinutesAgenda"]').text('');
					$('[p-select="printMinutesContent"]').html('');
					$('[p-select="printMinutesNote"]').text('');

					$('.report__form').hide();
				}
			});

		}
	};

	window.bookmarkInit = {
		documentInfoMap: null,
		init: () => {
			$('[p-select="bookmark-popup"]').on('click', function(){
				if(defaultInit.endCheck == true) return customAlert('1091');
				showPopup($('.js-popup-bookmark'));
			});

			$('.js-popup-bookmark').on('showpopup', function(){
				$.ajax({
					beforeSend: beforeSend,
					type: 'POST',
					url: '/files/document/list',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						ccode: confCode,
						type: 'document'
					}),
					success: function(data) {
						bookmarkInit.setBookmarkList(data.result);
					},
					error: function(e) {
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
					}
					}
				})
			});

			$('.js-popup-bookmark').on('hidepopup', function(){
				$('[p-select="documentTitle"]').val('');
				$('[p-select="documentSelect"]').val('');
				$('[p-select="documentThumList"]').empty();
			});

			$('[p-select="btn-bookmark"]').on('click', function(){
				bookmarkInit.toggleBookmarkLayer();
			});

			$('[p-select="bookmark-layer"] .product__close').on('click', function(){
				bookmarkInit.toggleBookmarkLayer();
			});

			$('[p-select="documentSelect"]').on('keyup', function(){
				let val = $(this).val();

				//if($.isNumeric(val)) val = parseInt(val);

				if($(`[p-select="thumRow"][p-data="${val}"]`).length > 0) {
					$(`[p-select="thumRow"][p-data="${val}"]`)[0].click();
					$('[p-select="documentThumList"]').scrollTop($(`[p-select="thumRow"][p-data="${val}"]`).offset().top)
				}
			});

			bookmarkInit.bookmarkBindEvent();
			bookmarkInit.setSaveBindEvent();
			bookmarkInit.bookmarkDraggable();
		},

		toggleBookmarkLayer: () => {
			$('[p-select="bookmark-layer"]').toggleClass('active');
			if($('[p-select="bookmark-layer"]').hasClass('active')) {
				$('#bookmark').addClass('selected');
				bookmarkInit.getBookmarkList();
			}else{
				$('#bookmark').removeClass('selected');
			}
		},

		setSaveBindEvent: () => {
			$('[p-select="bookmark-save"]').on('click', function() {
				let documentTitle = $('[p-select="documentTitle"]').val();
				let documentName = $('[p-select="documentList"]').val();
				let page = $('[p-select="documentSelect"]').attr('p-data');

				if(documentName == null) return customAlert('1077');
				if($(`[p-select="thumRow"][p-data="${page}"]`).length == 0) return customAlert('2064');

				let fcode = bookmarkInit.documentInfoMap[documentName]['fcode'];
				let originalname = bookmarkInit.documentInfoMap[documentName]['originalname'];

				if(documentTitle == null || documentTitle.trim() == '') {
					return customAlert('1018');
				}

				$.ajax({
					beforeSend: beforeSend,
					type: 'POST',
					url: '/conference/bookmark/setBookmark',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						ccode: confCode,
						fcode: fcode,
						title: documentTitle,
						name: documentName,
						originalname: originalname,
						page: page
					}),
					success: function(data) {
						hidePopup($('.js-popup-bookmark'));
						$('[p-select="documentTitle"]').val('');
						$('[p-select="documentSelect"]').val('');
						bookmarkInit.getBookmarkList();
					},
					error: function(e) {
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
					}
					}
				})
			});
		},

		setBookmarkList: (list) => {
			$('[p-select="documentList"]').empty();
			$('[p-select="documentSelect"]').removeAttr('p-data').val('');
			bookmarkInit.documentInfoMap = {};

			let currentPdfName = PDFViewerApplication.baseUrl.replace('/pdfs/', '').replace('.pdf', '');
			let currentPage = PDFViewerApplication.page;

			for(let i of list) {
				let originalname = i.originalname;
				let pdfFileName = i.pdfFileName;
				let pages = i.pages;
				let fcode = i.fcode;

				pdfFileName = pdfFileName.substr(0, pdfFileName.lastIndexOf('.'));

				bookmarkInit.documentInfoMap[pdfFileName] = {page: pages, fcode: fcode, originalname: originalname};

				$('[p-select="documentList"]').append(`<option value="${pdfFileName}">${originalname}</option>`);
			}

			$('[p-select="documentList"]').niceSelect('update');
			$('[p-select="documentList"]').off('change').on('change', function(){
				let pdfName = $(this).val();
				let pages = bookmarkInit.documentInfoMap[pdfName]['page'];

				$('[p-select="documentThumList"]').empty();

				for(let i=0;i<pages; i++) {
					let tag = `<div class="thum__row" p-select="thumRow" p-data="${i+1}">
									<div class="thum__col">
										<div class="thum__item">
											<div class="thum__icon" p-data="/thumbnail/${pdfName}/thum_${i}.jpg" style="background-image: url(/thumbnail/${pdfName}/thum_${i}.jpg);"></div>
											<div class="thum__infos">
												<div class="thum__value">${(i+1)+' '+_spl('page')}</div>
											</div>
										</div>
									</div>
								</div>`;
					$('[p-select="documentThumList"]').append(tag);
				}

				$('[p-select="documentThumList"] [p-select="thumRow"]').off('click').on('click', function(){
					let page = $(this).attr('p-data');
					$('[p-select="thumRow"]').removeClass('active');
					$(this).addClass('active');

					$('[p-select="documentSelect"]').attr('p-data', page).val(page);
				});
			});

			$('[p-select="documentList"]').trigger('change');
			$('[p-select="documentList"]').val(currentPdfName).niceSelect('update').trigger('change');
			$('[p-select="documentThumList"]').scrollTop($('[p-select="thumRow"]').height()*(currentPage-1));
			//$(`[p-select="thumRow"][p-data="${currentPage}"]`).trigger('click');
			$('[p-select="documentTitle"]').focus();
		},

		getBookmarkList: () => {
			$('[p-select="bookmark-list"]').empty();
			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/bookmark/getList',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode
				}),
				success: function(data) {
					let result = data.result;
					for(let i of result) {
						let pdfName          = i.name;
						let thumbnail        = i.thumbnail;
						let page             = i.page;
						let title            = i.title;
						let turn             = i.turn;
						let originalname     = i.originalname;
						let _id     	  	 = i._id;
						let bcode     	  	 = i.bcode;

						let tag = `<li class="thum__row" p-select="thumRow" p-data="${page}" p-turn="${turn}" p-id="${_id}" p-pdf="${pdfName}">
									<div class="thum__col">
										<div class="thum__item">
											<div class="thum__icon" p-data="${thumbnail}" style="background-image: url(${thumbnail});"></div>
											<div class="thum__infos">
												<div class="thum__value" title="${originalname}">${originalname}</div>
												<div class="thum__sub">${title}</div>
											</div>
											<div class="schedule__control">
												<button type="button" class="schedule__button" p-select="deleteBtn" p-data="${bcode}">
													<svg class="icon icon-trash">
														<use xlink:href="#icon-trash"></use>
													</svg>
												</button>
											</div>
										</div>
									</div>
								</li>`;

						$('[p-select="bookmark-list"]').append(tag);
					}

					bookmarkInit.bookmarkItemBindEvent();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			})
		},

		bookmarkItemBindEvent: () => {
			$('[p-select="bookmark-list"] [p-select="thumRow"]').off('click').on('click', async function(){
				$('[p-select="thumRow"]').removeClass('active');
				$(this).addClass('active');

				let pdf = $(this).attr("p-pdf");
				let page = $(this).attr("p-data");
				defaultInit.userSyncToggle();
				documentInit.changePdf(`${pdf}.pdf`, page, true);
			});
			$('[p-select="thumRow"] [p-select="deleteBtn"]').off('click').on('click', async function(e){
				e.stopPropagation();
				let confirm = await customConfirm('1041');
				if(confirm == true) {
					let bcode = $(this).attr('p-data');
					$.ajax({
						beforeSend: beforeSend,
						url: '/conference/bookmark/delete',
						type : 'POST',
						contentType: 'application/json; charset=utf-8',
						data: JSON.stringify({
							ccode:confCode,
							bcode: bcode
						}),
						success: function(data) {
							documentInit.getBookmarkList();
						},
						error: function(e) {
							if(e?.responseJSON?.errorCode == 'auth_failed') {
								customAlert('1098');
								parent.location.href = '/';
							}
							let message = e?.responseJSON?.message;
							if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
							else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
								window.loc = true;
								alert(message);
								return location.href='/';
						}
						}
					});
				}
			});
		},

		bookmarkDraggable: () => {
			$(`[p-select="bookmark-list"]`).sortable({
				axis: 'y',
				//containment: 'parent',
				animation: 1,
				stop : function(ev, ui) {
					bookmarkInit.setBookmarkTurn();
			    }
			});
		},

		setBookmarkTurn: () => {
			let ele = $('[p-select="bookmark-list"] > [p-select="thumRow"]');
			let turnInfo = {};
			let turn = 0;
			ele.map(function(i, item){
				let id = $(item).attr('p-id');
				turnInfo[id] = turn++;
			});

			$.ajax({
				beforeSend: beforeSend,
				type: 'POST',
				url: '/conference/bookmark/setTurn',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					turnInfo: turnInfo
				}),
				success: function(){
					bookmarkInit.getBookmarkList();
				}
			});
		},

		bookmarkBindEvent: () => {
			$('.thum__icon').off('mouseenter').on('mouseenter', function(e){
				let image = $(this).attr('p-data');

				let x = $(this).offset().left+65;
				let y = $(this).offset().top+65;
				$(`<img src="${image}" class="thumbnail_detail" style="left: ${x}px; top: ${y}px;"/>`).appendTo('body');
			});

			$('.thum__icon').off('mouseleave').on('mouseleave', function(e){
				$('.thumbnail_detail').remove();
			});
		}
	};

	let voteInit = {
		voteInterval: [],
		voteUpdateInterval: null,
		voteAlarmInterval: null,
		voteRepeatAlarmInterval: null,
		voteRepeatAcode: null,
		voteInfo: {},
		autoOpenPvote: null,
		voteAgainVcode: null,
		init: () => {
			$('.js-popup-vote').off('showpopup').on('showpopup', function(popup, target){
				voteInit.getVoteList();
				voteInit.voteUpdateInterval = setInterval(function(){
					// if($('[p-select="live-streaming-box"]').is(':visible') == true) return;
					voteInit.updateStatus();
				}, 1000);
			});

			$('.js-popup-vote').off('hidepopup').on('hidepopup', function(popup, target){
				voteInit.voteInfo = {};

				clearInterval(voteInit.voteUpdateInterval);
				clearInterval(voteInit.voteAlarmInterval);
				voteInit.clearVoteInterval();
				voteInit.resetVoteDetail();
				voteInit.voteUpdateInterval = null;
				voteInit.voteAlarmInterval = null;
			});

			$('.js-popup-added-vote').off('showpopup').on('showpopup', function(popup, target){
				if($('.js-popup-added-vote').attr('type') != 'edit') {
					voteInit.resetVoteCreate();
				}
			});

			$('.js-popup-added-vote').off('hidepopup').on('hidepopup', function(popup, target){
				$('.js-popup-added-vote').removeAttr('type');
				voteInit.resetVoteCreate();
			});

			$('.js-popup-re-vote').off('showpopup').on('showpopup', function(popup, target){
				common.setTagify(conferenceInit.participant, '[p-select="vote_re_participants"]');
			});

			$('.js-popup-re-vote').off('hidepopup').on('hidepopup', function(popup, target){
				voteInit.voteAgainVcode = null;
				voteInit.resetVoteAgain();
			});

			$('[p-select="vote-type1"]').on('change', function() {
				let val = $(this).val();

				$('.vote__type').removeClass('active');
				if(val != 'on' && val != ''){
					$('.vote__type.'+val).addClass('active');
				}

				if(val == 't3') {
					$('[name=vote-type2][value=t2]').closest('label').hide();
				}else{
					$('[name=vote-type2][value=t2]').closest('label').show();
				}
			});

			$('[p-select="vote-start"]').on('change', function() {
				let val = $(this).val();

				if(val == "t1" || val == "t0") {
					$(".vote_start_select").hide();
				}else{
					$(".vote_start_select").show();
				}
			});

			$('[p-select="again-vote"]').on('click', function() {
				voteInit.setVoteAgain();
			})

			$('[p-select="vote-restart"]').on('change', function() {
				let val = $(this).val();

				if(val == "t1" || val == "t0") {
					$(".vote_re_start_select").hide();
				}else{
					$(".vote_re_start_select").show();
				}
			});

			$('[p-select="vote-added"]').on('change', function() {
				let val = $(this).val();

				if(val == "0") {
					$('[p-select="vote_added_time"]').attr('disabled', 'true').niceSelect('update');
				}else{
					$('[p-select="vote_added_time"]').removeAttr('disabled').niceSelect('update');
				}
			});

			$('[p-select="create-vote-btn"]').on('click', function(){
				if(defaultInit.endCheck == true) return customAlert('1091');
				showPopup($('.js-popup-added-vote'));
			});

			$('[p-select="create-vote"]').on('click', function() {
				voteInit.createVote();
			});

			$('[p-select="send-vote"]').on('click', function() {
				voteInit.sendVote();
			});

			$('[p-select="alarm-vote"]').on('click', function() {
				voteInit.showVoteParti();
			});

			$('[p-select="alarm-end-vote"]').on('click', function() {
				voteInit.showVoteResult();
			});
			//투표 상태
			$('[p-select="vote-parti"]').on('click', function(){
				if($(this).hasClass('red') == true || $(this).hasClass('black') == true) return;
				let status = $('[p-select="vote-list-item"].active').attr('p-status');

				switch(status) {
					case "0":
						return customAlert('1047');
					break;

					case "1":
						showPopup($(".js-popup-pvote"));
					break;

					case "2":
						return customAlert('1048');
					break;
				}
			});
			// 투표 새창 열기
			$('[p-select="vote-status"]').on('click', function(){
				let vcode = $('[p-select="vote-list-item"].active').attr('p-vcode');
				let ccode = confCode;
				if ( vcode !== "undefined" && vcode.trim() !== "") {
					window.open(`/voteStatus?ccode=${ccode}&vcode=${vcode}`);
				}
			});

			$('[p-select="vote-result"]').on('click', function(){
				let vcode = $('[p-select="vote-list-item"].active').attr('p-vcode');
				let ccode = confCode;
				window.open(`/voteResult?ccode=${ccode}&vcode=${vcode}`);
			});

			$('[p-select="vote-detail-list"]').hide();

			
			common.setTagify(conferenceInit.participant, '[p-select="vote-participants"]');
			voteInit.resetVoteCreate();
			voteInit.resetVoteDetail();
			voteInit.startAlarmAndAfter(); 
			voteInit.setRepeatIntervalAlarm();

			voteInit.addVoteField(null, 't1');
			voteInit.addVoteField(null, 't2');
			voteInit.addVoteField(null, 't3');
		},

		startAlarmAndAfter: () => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getVoteAlarms',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode
				}),
				success: function(data) {
					let result = data.result;
					if(result != null && result.length != 0) {
						for(let i of result) {
							if(i.type == 'start' && conferenceInit.nowServerTime > i.time) {
								voteInit.sendStartVoteAlarm(i.message, i.vcode, i.acode);
							}
						}
					}
					voteInit.deleteStartAlarm();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;

					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
			
		},

		deleteStartAlarm: () => {
			$.ajax({
				beforeSend,
				url: '/vote/deleteStartAlarm',
				type: 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({ ccode: confCode }),
				success: function(data) {
					console.log("deleteStartAlarm: success=>", confCode);
					voteInit.getIntervalAlarm();
					voteInit.resetVoteAlarmInterval(); // 💡 새로운 함수로 깔끔하게 정리
				},
				error: function(e) {
					voteInit.handleDeleteAlarmError(e); // 💡 공통 에러 핸들링 함수 호출
				}
			});
		},
		
		resetVoteAlarmInterval: function () {
			if (voteInit.voteAlarmInterval) {
				console.log("기존 인터벌 제거: ", voteInit.voteAlarmInterval);
				clearInterval(voteInit.voteAlarmInterval);
				voteInit.voteAlarmInterval = null;
			}
			voteInit.voteAlarmInterval = setInterval(() => {
				voteInit.getIntervalAlarm();
			}, 5000);
		},
		
		handleDeleteAlarmError: function (e) {
			console.log("deleteStartAlarm: error=>", confCode);
		
			const errorCode = e?.responseJSON?.errorCode;
			const message = e?.responseJSON?.message;
		
			if (errorCode === 'auth_failed') {
				customAlert('1098');
				parent.location.href = '/';
				return;
			}
		
			if (message && errorCode !== '1016' && message !== '1016') {
				alert(message);
				return;
			}
		
			if ((message === '1016' || errorCode === '1016') && !window.loc) {
				window.loc = true;
				alert(message);
				location.href = '/';
			}
		},

		deleteRepeatAlarm: (vcode) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/deleteRepeatAlarm',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					vcode: vcode
				}),
				success: function(data) {
					return;
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		deleteAlarm: (acode) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/deleteAlarm',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode,
					acode: acode
				}),
				success: function(data) {
					console.log("deleteAlarm: success=>", confCode, acode )
					voteInit.getIntervalAlarm();
					clearInterval(voteInit.voteAlarmInterval);
					voteInit.voteAlarmInterval = setInterval(function(){
						// if($('[p-select="live-streaming-box"]').is(':visible') == true) return;
						voteInit.getIntervalAlarm();
					}, 5000);
				},
				error: function(e) {
					console.log("deleteAlarm: error=>", confCode, acode )

					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		deleteAlarmAll: (vcode) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/deleteAlarmAll',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode,
					vcode: vcode
				}),
				success: function(data) {
					return;
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},
		
		showVoteAlarm: async (acode) => {
			if(conferenceInit.setting != null && conferenceInit.setting['voteAlarm'] == false) return false;
			let code = null;
			if(acode != null){
				code = acode;
			}else if(voteInit.voteRepeatAcode != null) {
				code = voteInit.voteRepeatAcode;
			}else{
				return;
			}

			let alaram = await voteInit.getAlarm(code);
			if(alaram == null) return;
			let message = await common.getMessage(alaram.message);

			alarmInit.showToast(message, 'bottom-right', 'warning', function(){
				voteInit.showVoteParti(alaram.vcode);
			});
		},
		//참여하지 않는 투표가 있습니다.
		setRepeatIntervalAlarm: () => {
			voteInit.showVoteAlarm();
			voteInit.voteRepeatAlarmInterval = setInterval(async function(){
				if($('[p-select="live-streaming-box"]').is(':visible') == true) return;
				voteInit.showVoteAlarm();
			}, 1000*60*10);
		},

		getAlarm: async (acode) => {
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getVoteAlarm',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					acode: acode
				}),
				success: function(data) {
					let result = data.result;
					deferred.resolve(result);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});

			return deferred.promise();
		},
		

		getIntervalAlarm: () => {

			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getVoteAlarms',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode
				}),
				success: function(data) {
					let result = data.result;
					if(result != null && result.length != 0) {
						let repeat = false;
						let repeatAcode = null;

						for (let i of result) {
							let currentTimeServer = moment(i.currentTime);
							let timeDiffMinutes = currentTimeServer.diff(i.time, "m");
							let timeDiffSeconds = currentTimeServer.diff(i.time, "s");
							
							switch (i.type) {
								case 'start':
									if (currentTimeServer.valueOf() > i.time) {
										voteInit.sendStartVoteAlarm(i.message, i.vcode, i.acode);
									}
									break;
								
								case 'repeat':
									if (timeDiffMinutes > 0) {
										repeat = true;
										repeatAcode = i.acode;
									}
									break;
								
								case 'end10minute':
								case 'end3minute':
									if (timeDiffMinutes >= 1) {
										voteInit.deleteAlarm(i.acode);
										voteInit.deleteRepeatAlarm(i.vcode);
									}
									if (timeDiffSeconds >= 0) {
										voteInit.showVoteAlarm(i.acode);
										voteInit.deleteAlarm(i.acode);
										voteInit.deleteRepeatAlarm(i.vcode);
									}
									break;
								
								case 'end':
									if (timeDiffSeconds >= 0) {
										voteInit.sendEndVoteAlarm(i.message, i.vcode, i.acode);
										if (voteInit.voteRepeatAcode === i.acode) {
											voteInit.voteRepeatAcode = null;
										}
										break;
									}
							}
						  }

						if(repeat == false) {
							voteInit.voteRepeatAcode = null;
						}else if(repeat == true) {
							voteInit.voteRepeatAcode = repeatAcode;
						}
					}else{
						voteInit.voteRepeatAcode = null;
					}
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;

					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
					}
				}
			});
		},

		sendStartVoteAlarm: async (message, vcode, acode) => {

			if(conferenceInit.setting != null && conferenceInit.setting['voteAlarm'] == false) return false;
			let data = await voteInit.getVoteTitle(vcode);
			voteInit.alarmVotePopup(message, vcode, data.title);
			voteInit.deleteAlarm(acode);
		},

		sendEndVoteAlarm: async (message, vcode, acode) => {
			if(conferenceInit.setting != null && conferenceInit.setting['voteAlarm'] == false) return false;
			let data = await voteInit.getVoteTitle(vcode);
			try{
				voteInit.alarmEndVotePopup(message, vcode, data.title);
			}catch(e){}
			voteInit.deleteAlarmAll(vcode);
		},

		getVoteTitle: (vcode) => {
			let deferred = $.Deferred();

			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getVoteTitle',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode: confCode,
					vcode: vcode
				}),
				success: function(data) {
					let result = data.result;
					deferred.resolve(result);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						return location.href='/';
				}
				}
			});

			return deferred.promise();
		},

		sendVote: async () => {
			// let confirm = await customConfirm('1026');
			let listLayer = $('[p-select="vote-detail-list2"]');
			let field = {};
			let vcode = voteInit.voteInfo.vcode;

			if(voteInit.voteInfo.item_type == 't1' || voteInit.voteInfo.item_type == 't2'){
				let items = listLayer.find('[name=vote_list_select]')
				let allUnchecked = true;

				for (let i of items) {
					const isChecked = $(i).is(':checked');
					if (isChecked) {
						allUnchecked = false;
					}
				}
				if (allUnchecked) {
					alert("선택된 항목이 없습니다.");
					return;
				}

				if(voteInit.voteInfo.multiple != true && listLayer.find('[name=vote_list_select]:checked').length > 1) {
					return await customAlert('1027');
				}
				for(let i of items) {
					field[$(i).val()] = $(i).is(':checked');
				}

			}else if(voteInit.voteInfo.item_type == 't3'){
				let items = listLayer.find('textarea.field__input');

				let allUnchecked = true;

				for (let i of items) {
					const isChecked = $(i).val();;
					if (isChecked.trim() != '') {
						allUnchecked = false;
						break;
					}
				}
				if (allUnchecked) {
					alert("내용을 입력해 주십시오");
					return;
				}
			
				for(let i of items) {
					field[$(i).attr('vcode')] = $(i).val();
				}
			}

			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/sendVote',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					vcode: vcode,
					confCode:confCode,
					field: field
				}),
				success: function(data) {
					voteInit.getVoteList();
					voteInit.voteDetail(vcode, $(`[p-select="vote-list-item"][p-vcode="${vcode}]`)[0]);
					return customAlert('1029', function(){hidePopup($('.js-popup-pvote'))})
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
			
		},
		//투표 참여 투표 리스트
		resetVoteDetail: () => {
			$('[p-select="voteDetailTitle"]').text('');
			$('[p-select="vote-parti"]').hide();
			$('[p-select="vote-result"]').hide();
			$('[p-select="vote-status"]').hide();
			DataSet.voteDetailTitle.value = '';
			$('[p-select=vote_detail_content]').text(_spl('voteDetailTitle'));
			$('[p-select="vote_detail_detail"]').removeClass('active');
			$('[p-select=vote-detail-list]').hide();
		},


		setVoteDetail: (data) => {
			let result = data.result;
			let title = '';

			if(result.anonymous == true && result.multiple == true) {
				title = _spl('anonymousMultiple')+' ';
			}else if(result.anonymous == true && result.multiple == false) {
				title = _spl('anonymousVote')+' ';
			}else if(result.anonymous == false && result.multiple == true) {
				title = _spl('multipleVote')+' ';
			}

			DataSet.voteDetailTitle.value = title+result.title;
			$('[p-select=vote_detail_content]').html(result.contents);
			$('[p-select=vote-detail-list] .customer__row').not(':first-child').empty();
			$('[p-select=vote-detail-list2]').empty();
			$('[p-select="voteResultList"]').empty();
			$('[p-select="vote_detail_detail"]').removeClass('active');

			$('[p-select="vote-parti"]').show();
			$('[p-select="vote-status"]').show();

			if(result.participants[currUcode] == null) {
				$('[p-select="vote-parti"]').addClass('black');
				$('[p-select="vote-parti"]').removeAttr('data-popup');
				$('[p-select="vote-parti"]').text(_spl('noAdmsVote'));
			}else if(result.participants[currUcode] == true) {
				$('[p-select="vote-parti"]').addClass('red');
				$('[p-select="vote-parti"]').removeAttr('data-popup');
				$('[p-select="vote-parti"]').text(_spl('compPartiVote'));
			}else{
				$('[p-select="vote-parti"]').removeClass('red black');
				$('[p-select="vote-parti"]').text(_spl('voteParti'));
			}

			if(result.status == 2) {
				$('[p-select="voteDetailTitle"]').text(_spl('closedVoteEnd'));
				$('[p-select="vote-parti"]').hide();
				$('[p-select="vote-status"]').hide();
				$('[p-select="vote-result"]').show();
			}else if(result.status == 0){
				$('[p-select="voteDetailTitle"]').text(_spl('waitVoteStart'));
				$('[p-select="vote-parti"]').hide();
				$('[p-select="vote-status"]').show();
				$('[p-select="vote-result"]').hide();
			}else{
				$('[p-select="voteDetailTitle"]').text(_spl('vote'));
				$('[p-select="vote-result"]').hide();
				$('[p-select="vote-status"]').show();
			}

			dataPopupBind();

			voteInit.voteInfo = {
				item_type : result.item_type,
				multiple: result.multiple,
				vcode: result.vcode
			};

			if(result.item_type == 't1' || result.item_type == 't2') {
				for(let i of result.list) {
					let tag = `<label class="radio query_field">
								<input class="radio__input" type="radio" name="vote_list_select" value="%VALUE%"><span class="radio__inner"><span class="radio__tick"></span><span class="radio__text pl__5">%ASSENT%</span></span>
							</label>`;
					if(result.multiple == true) {
						tag = `<label class="checkbox query_field">
									<input class="checkbox__input" type="checkbox" name="vote_list_select" value="%VALUE%"><span class="checkbox__inner"><span class="checkbox__tick"></span><span class="checkbox__text pl__5">%ASSENT%</span></span>
								</label>`;
					}

					tag = tag.replace('%VALUE%', i.k).replace('%ASSENT%', i.c);
					$('[p-select="vote-detail-list2"]').append(tag);
					$('[p-select="vote-detail-list2"]').attr('id', result.vcode);
				}
			}else if(result.item_type == 't3') {
				let idx = 1;
				for(let i of result.list) {
					let tag = `<label class="textarea query_field">
									<p>${idx++}. ${i.c}</p>
									<textarea class="field__input" vcode="${i.k}"></textarea>
								</label>`;

					$('[p-select="vote-detail-list2"]').append(tag);
					$('[p-select="vote-detail-list2"]').attr('id', result.vcode);
				}
			}

			voteInit.getVoteResult(result.vcode, result.item_type);
		},

		updateStatus: () => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getStatus',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode
				}),
				success: function(data) {
					let result = data.result;

					// 화면에 있는 vcode 리스트 가져오기
					let vcodesListScreen = $('[p-select="vote-list-item"]').map((_, el) => $(el).attr('p-vcode')).get();

					// 서버에서 받아오는 vcode 리스트 가져오기
					let resultVcodes = result.map(item => item.vcode); // 서버 데이터에서 vcode만 추출

					// 서버에 없는 vcode 찾기 (화면에는 있는데 서버 데이터에는 없음): 투표를 삭제한 경우
					let extraVcodes = vcodesListScreen.filter(vcode => !resultVcodes.includes(vcode));

					// 서버에는 있는데 화면에 없는 vcode 찾기: 투표를 생성한 경우
					let missingVcodes = resultVcodes.filter(vcode => !vcodesListScreen.includes(vcode));

					let filteredVcodes = vcodesListScreen.filter(vcode => {
	
						const domStatus = Number($(`[p-select="vote-list-item"][p-vcode=${vcode}]`).attr('p-status'));
					
						const resultItem = result.find(item => item.vcode === vcode);
					
						if (!resultItem) return false; // result에 해당 vcode가 없으면 필터 제외					
						if(domStatus !== resultItem.status){ return true; } // 상태가 다르면 필터링
					});

					if (missingVcodes.length > 0 || extraVcodes.length > 0 || filteredVcodes.length > 0){
						voteInit.getVoteList();
					}

					for(let i of result) {
						let ele = $(`[p-select="vote-list-item"][p-vcode=${i.vcode}]`);
						let eleStatus = $(`[p-select="vote-list-item"][p-vcode=${i.vcode}]`).attr('p-status');

						if(ele.length != 0) {
							ele.attr('p-status', i.status);
							ele.find('.messages__head > .messages__time').text( (i.participants == true ? _spl('spacingCompVote'):'') );
							let status = (i.status == 0 ? _spl('standBy'): (i.status == 1 ? _spl('voting') : _spl('end')) );
							let color = (i.status == 0 ? 'blue': (i.status == 1 ? 'green' : 'red') );
							ele.children('.vote__status').removeClass('blue green red').addClass(color).text(status);

							if(eleStatus == '1' && i.status == 2) {
								$('.conference__vote .shop__container .js-tabs-item').eq(1).children('.messages__list').append(ele);
								$('.conference__vote .shop__container .js-tabs-item').eq(0).find(`[p-select="vote-list-item"][p-vcode=${i.vcode}]`).remove();

								let ongoingVoteCount = $('[p-select="ongoingVoteCount"]').text();
								let closedVoteCount = $('[p-select="closedVoteCount"]').text();

								ongoingVoteCount--;
								closedVoteCount++;

								ongoingVoteCount 	= (parseInt(ongoingVoteCount) < 0 ? 0 : parseInt(ongoingVoteCount));
								closedVoteCount 	= (parseInt(closedVoteCount) < 0 ? 0 : parseInt(closedVoteCount));

								$('[p-select="ongoingVoteCount"]').text(ongoingVoteCount);
								$('[p-select="closedVoteCount"]').text(closedVoteCount);
							}
						}
					}

					if(voteInit.voteAlarmInterval == null){
						console.log("===========voteAlarmInterval 확인");
						voteInit.voteAlarmInterval = setInterval(function(){
							// if($('[p-select="live-streaming-box"]').is(':visible') == true) return;
							voteInit.getIntervalAlarm();
						}, 5000);
					}

				}
			});
		},
		

		getVoteResult: (vcode, type) => {
			let vote_type = type;

			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getVoteResult',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					confCode:confCode,
					vcode: vcode
				}),
				success: function(data) {
					let result = data.result;
					let resultArray = [];
					for(let i in result) {
						resultArray.push(result[i]);
					}
					resultArray.sort(voteInit.arrOrder('turn'));
					voteInit.voteInfo['result'] = data.result;

					$('[p-select=vote-detail-list] .customer__row').not(':first-child').remove();
					for(let i of resultArray) {
						let tag = `	<div class="customer__row" p-select="vote-result-detail" p-code="${i.code}">
										<div class="customer__col dis__none"></div>
										<div class="customer__col">
											<div class="customer__item">
												<div class="customer__description">
													<div>${i.question}</div>
												</div>
											</div>
										</div>
										<div class="customer__col"><div class="customer__item">${i.trueList.length+_spl('person')}</div></div>
									</div>`;
						$('[p-select=vote-detail-list]').append(tag);
					}

					$('[p-select="vote-result-detail"]').on('click', function(){
						let code = $(this).attr('p-code');
						voteInit.setVoteResultDetail(code, vote_type)
					});

					$('[p-select=vote-detail-list]').show();
					bindFilter();

					if(voteInit.autoOpenPvote == true) {
						showPopup($(".js-popup-pvote"));
						hidePopup($('.js-popup-alarm-vote'));
						voteInit.autoOpenPvote = false;
					}
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		setVoteResultDetail: (rcode, type) => {
			$('[p-select="voteResultList"]').empty();
			if(voteInit.voteInfo['result'] != null && voteInit.voteInfo['result'][rcode] != null) {
				let result = voteInit.voteInfo['result'][rcode];
				let trueList = result['trueList'];
				let falseList = result['falseList'];
				let dontVoteList = result['dontVoteList'] || {};

				let trueTag = $(`<div class="vresult__item select1">
									<div class="vresult__select" p-value="selection"></div>
									<div class="vresult__count">(${trueList.length+' '+_spl('person')})</div>
									<div class="vresult__list">
										<ul></ul>
									</div>
								</div>`);

				let dvTag = $(`<div class="vresult__item select2">
									<div class="vresult__select dontVote" p-value="notVote"></div>
									<div class="vresult__count">(${(result.anonymous == false ? Object.keys(dontVoteList).length: dontVoteList)+' '+_spl('person')})</div>
									<div class="vresult__list">
										<ul></ul>
									</div>
								</div>`);

				if(result.anonymous == false) {
					for(let i of trueList) {
						if(type == 't3') {
							trueTag.find('ul').append(`<li>${i.id} (${i.name})<p style="font-weight: bold;">${i.result}</p></li>`);
						}else{
							trueTag.find('ul').append(`<li>${i.id} (${i.name})</li>`);
						}
						$('[p-select="voteResultList"]').append(trueTag);
					}
					if(trueList.length == 0) {
						trueTag.find('ul').append(`<li p-value="empty"></li>`);
						$('[p-select="voteResultList"]').append(trueTag);
					}

					for(let i in dontVoteList) {
						dvTag.find('ul').append(`<li>${dontVoteList[i].id} (${dontVoteList[i].name})</li>`);
						$('[p-select="voteResultList"]').append(dvTag);
					}
					if(dontVoteList == null || Object.keys(dontVoteList).length == 0) {
						dvTag.find('ul').append(`<li p-value="empty"></li>`);
						$('[p-select="voteResultList"]').append(dvTag);
					}
				}

				$('[p-select="voteResultList"]').append(trueTag);
				$('[p-select="voteResultList"]').append(dvTag);
			}
		},

		arrOrder: (key) => {
			return function(a, b) {
				if (a[key] > b[key]) {
					return 1;
				} else if (a[key] < b[key]) {
					return -1;
				}

				return 0;
			}
		},

		getVoteList: (callee) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getList',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode
				}),
				success: function(data) {

					// if(callee != null && typeof callee == 'function') {
					// 	callee(data);
					// } else {
					// 	voteInit.setVoteList(data);
					// }

					// ✅ 서버 시간 저장
					if (data?.length > 0 && data[0].currentTime) {
						conferenceInit.nowServerTime = moment(data[0].currentTime, 'YYYY-MM-DD HH:mm:ss').valueOf();

						// ✅ 서버 시간 흐르게 유지
						if (!conferenceInit._serverTimeTimerStarted) {
							conferenceInit._serverTimeTimerStarted = true;

							setInterval(() => {
								conferenceInit.nowServerTime += 1000;
							}, 1000);
						}
					}

					// ✅ 기존 투표 목록 설정
					voteInit.setVoteList(data);

					if (callee != null && typeof callee == 'function') {
						callee(data);
					}

				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},



		clearVoteInterval: () => {
			if(voteInit.voteInterval != null && voteInit.voteInterval.length != 0) {
				for(let i of voteInit.voteInterval) {
					clearInterval(i);
				}
			}
			voteInit.voteInterval = [];
		},
		
		//남은시간
		setVoteCountdown: (element, startDateTime, endDateTime, vcode, currentTime) => {
			let getCurrentTime = moment(currentTime);
			let startTime = moment(startDateTime);
			let endTime = moment(endDateTime);
			let interval = 1000;
		
			const setRemainText = (duration) => {
				let hours = (duration.hours() < 10) ? '0' + duration.hours() : duration.hours();
				let minutes = (duration.minutes() < 10) ? '0' + duration.minutes() : duration.minutes();
				let seconds = (duration.seconds() < 10) ? '0' + duration.seconds() : duration.seconds();
		
				let message = '';
				if (parseInt(hours) != 0) {
					message = `${hours + _spl('hour')} `;
				}
				if (parseInt(hours) != 0 || parseInt(minutes) != 0) {
					message += `${minutes + _spl('minute')} `;
				}
				message += `${seconds + _spl('second')}`;
				return message;
			};
		
			if (startDateTime === '') {
				$(element).find('[p-select="remainTime"]').text('대기');
				$(document).find('[p-select="remainTimeUser"]').text('대기');
				return null;
			}
		
			// 초기 판단
			if (getCurrentTime.isBefore(startTime)) {
				$(element).find('[p-select="remainTime"]').text(_spl('waitVote'));
				$(document).find('[p-select="remainTimeUser"]').text(_spl('waitVote'));
			} else if (getCurrentTime.isAfter(endTime)) {
				$(element).find('[p-select="remainTime"]').text(_spl('voteEnd'));
				$(document).find('[p-select="remainTimeUser"]').text(_spl('voteEnd'));
			} else {
				let leftTime = endTime.unix() - getCurrentTime.unix();
				let duration = moment.duration(leftTime, 'seconds');
				let initialMessage = setRemainText(duration);
				$(element).find('[p-select="remainTime"]').text(initialMessage);
				if ($('[p-select="vote-detail-list2"]').attr('id') == vcode) {
					$(document).find('[p-select="remainTimeUser"]').text("투표 종료까지: " + initialMessage);
				}
			}
		
			// 타이머 시작
			let intv = setInterval(function () {
				getCurrentTime.add(1, 'seconds');
		
				if (getCurrentTime.isBefore(startTime)) {
					$(element).find('[p-select="remainTime"]').text(_spl('waitVote'));
					$(document).find('[p-select="remainTimeUser"]').text(_spl('waitVote'));
					// 타이머 유지 (대기 후 바로 타이머 돌게 하기 위해)
					return;
				}
		
				if (getCurrentTime.isAfter(endTime)) {
					$(element).find('[p-select="remainTime"]').text(_spl('voteEnd'));
					$(document).find('[p-select="remainTimeUser"]').text(_spl('voteEnd'));
					clearInterval(intv);
					return;
				}
		
				let duration = moment.duration(endTime.unix() - getCurrentTime.unix(), 'seconds');
				let message = setRemainText(duration);
				$(element).find('[p-select="remainTime"]').text(message);
		
				if ($('[p-select="vote-detail-list2"]').attr('id') == vcode) {
					$(document).find('[p-select="remainTimeUser"]').text("투표 종료까지: " + message);
				}
			}, interval);
		
			return intv;
		},
		
		setVoteList: (data) => {
			let result = data?.result;
			// data.result에서 가져온 .messages__list 초기화
			$('.conference__vote .shop__container .messages__list').empty();

			voteInit.clearVoteInterval();

			let ongoingVoteCount = 0;
			let closeVoteCount = 0;

			for(let i of result) {
				let status = (i.status == 0 ? _spl('standBy'): (i.status == 1 ? _spl('voting') : _spl('end')) );
				let color = (i.status == 0 ? ' blue': (i.status == 1 ? ' green' : ' red') );
				let dispalyNone = (i.status == 0 ? 'style=\'display:block\'' : (i.status == 1 ? 'style=\'display:none\'' : 'style=\'display:none\'')   );
				let tag = `<div class="messages__item" p-select="vote-list-item" p-vcode="${i.vcode}" p-status="${i.status}">
								<div class="vote__status${color}">${status}</div>
								<div class="messages__details">
									<div class="messages__head">
										<div class="messages__man">${(i.anonymous == true ? _spl('anonymousBracket') :"")}${i.title}</div>
									</div>
									<div class="messages__time ml__0">${(i.participants[currUcode] == true ? _spl('spacingCompVote'):_spl('notVote') )}</div>
									<div class="messages__time ml__0">${_spl('remainingTime')+' : '}<span p-select="remainTime"></span></div>
									<div class="messages__content">
										${_spl('start')+' : '}${(i.start_date && moment(i.start_date).isValid()) ? moment(i.start_date).format('YYYY-MM-DD HH:mm:ss') : _spl('standBy')}
									</div>
									<div class="messages__content">
										${_spl('end')+' : '}${(i.end_date && moment(i.end_date).isValid()) ? moment(i.end_date).format('YYYY-MM-DD HH:mm:ss') : _spl('standBy')}
									</div>
								</div>
								<div class="schedule__control">
									<!-- <div class="actions actions_small">
										<button class="actions__button" p-data="${i.vcode}" p-select="voteBtns" p-updated="${i.user == currUcode ? true: false}">
											<svg class="icon icon-more-horizontal">
												<use xlink:href="#icon-more-horizontal"></use>
											</svg>
										</button>
									</div>
									button type="button" class="schedule__button mr__5" p-select="voteCopy" p-data="${i.vcode}">
										<svg class="icon icon-copy">
											<use xlink:href="#icon-copy"></use>
										</svg>
									</button>
									<button type="button" class="schedule__button" p-select="voteDelete" p-data="${i.vcode}">
										<svg class="icon icon-trash">
											<use xlink:href="#icon-trash"></use>
										</svg>
									</button-->
								</div>
								<div class="actions actions_small" ${dispalyNone}>
										<button class="actions__button" p-data="${i.vcode}" p-select="voteBtns" p-updated="${i.user == currUcode ? true: false}">
											<svg class="icon icon-more-horizontal">
												<use xlink:href="#icon-more-horizontal"></use>
											</svg>
										</button>
									</div>
							</div>`;

				let item = null;
				if(i.status == 2){
					//$('.conference__vote .shop__container .js-tabs-item').eq(1).children('.messages__list').append(tag);
					item = $('.conference__vote .shop__container .js-tabs-item').eq(1).children('.messages__list');
					closeVoteCount++;
				}else{
					//$('.conference__vote .shop__container .js-tabs-item').eq(0).children('.messages__list').append(tag);
					item = $('.conference__vote .shop__container .js-tabs-item').eq(0).children('.messages__list');
					ongoingVoteCount++;
				}

				let element = $(tag).appendTo(item);

				if(voteInit.voteInterval == null) voteInit.voteInterval = [];
				voteInit.voteInterval.push(voteInit.setVoteCountdown(element, i.start_date, i.end_date, i.vcode, i.currentTime));
			}

			$('[p-select="vote-list-item"]').on('click', function(){
				let vcode = $(this).attr('p-vcode');
				voteInit.voteDetail(vcode, this);
			});
			//$('[p-select="voteBtns"]').on()
			typpeInit.voteTyppyInstance = tippy('[p-select="voteBtns"]', {
				content: `<div class="actions actions_small">
								<div class="list__item actions__body">
									<button type="button" class="actions__option" p-select="voteEdit">
										<svg class="icon icon-edit">
											<use xlink:href="#icon-edit"></use>
										</svg> ${_spl('modification')}
									</button>
									<button type="button" class="actions__option" p-select="voteCopy">
										<svg class="icon icon-copy">
											<use xlink:href="#icon-copy"></use>
										</svg> ${_spl('copy')}
									</button>
									<button type="button" class="actions__option" p-select="voteAgain">
										<svg class="icon icon-link">
											<use xlink:href="#icon-link"></use>
										</svg> ${_spl('revote')}
									</button>
									<button type="button" class="actions__option" p-select="voteDelete">
										<svg class="icon icon-trash">
											<use xlink:href="#icon-trash"></use>
										</svg> ${_spl('deleteBtn')}
									</button>
									<button type="button" class="actions__option" p-select="voteStart">
										<svg class="icon icon-activity">
											<use xlink:href="#icon-activity"></use>
										</svg> ${_spl('start')}
									</button>
								</div>
							</div>`,
				allowHTML: true,
				popperOptions: {
				    positionFixed: true
				},
				appendTo: document.body,
				interactive: true,
				zIndex: 1000000000,
				trigger: 'click',
				onTrigger: (instance, event) => {
					event.stopPropagation();
				},
				onShow: (instance) => {
					let updated = $(instance.reference).attr('p-updated');
					if(updated == "false") {
						$('#votePopupStyle').html(`
							[p-select="voteEdit"] {display:none;}
							[p-select="voteDelete"] {display:none;}
							[p-select="voteAgain"] {display:none;}
							[p-select="voteStart"] {display:none;}							
						`);
					}else{
						$('#votePopupStyle').html(`
							[p-select="voteEdit"] {display:flex;}
							[p-select="voteDelete"] {display:flex;}
							[p-select="voteAgain"] {display:flex;}
							[p-select="voteStart"] {display:flex;}
						`);
					}

					
				},
				onShown: (instance) => {
					let vcode = $(instance.reference).attr('p-data');

					$('[p-select="voteDelete"]').off('click').on('click', function(e){
						e.stopPropagation();
						voteInit.voteDelete(vcode);
					})

					$('[p-select="voteCopy"]').off('click').on('click', function(e){
						e.stopPropagation();
						voteInit.voteCopy(vcode);
					})

					$('[p-select="voteEdit"]').off('click').on('click', function(e){
						e.stopPropagation();
						voteInit.voteEdit(vcode);
					})

					$('[p-select="voteStart"]').off('click').on('click', function(e){
						e.stopPropagation();
						voteInit.voteStart(vcode);
					})

					

					$('[p-select="voteAgain"]').off('click').on('click', function(e){
						e.stopPropagation();
						voteInit.voteAgain(vcode);
					})
				}
			});

			$('[p-select="ongoingVoteCount"]').text(ongoingVoteCount);
			$('[p-select="closedVoteCount"]').text(closeVoteCount);
		},
		

		resetVoteAgain: () => {
			$('[p-select="vote_re_start_input"]').val('');
			$('[p-select="vote-restart"][value="t0"]').prop('checked', true).trigger('change');
			$('[p-select=vote_re_limit_minute]').val('5').niceSelect('update');
			$('[p-select=vote_re_participants]').val(null);
		},

		voteAgain: (vcode) => {
			voteInit.resetVoteAgain();
			typpeInit.hideAllTyppy();

			voteInit.voteAgainVcode = vcode;

			showPopup($('.js-popup-re-vote'));
		},

		voteStart: async (vcode) => {

			console.log(' voteStart!!!')
			
			
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/startVote',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode,
					vcode: vcode
				}),
				success: function(data) {
					voteInit.resetVoteDetail();
					voteInit.getVoteList();
					typpeInit.hideAllTyppy();
					// checkAndUpdateVoteList(data.result);
				},
				error: function(e) {
					typpeInit.hideAllTyppy();
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
			
		},

		setVoteAgain: async () => {
			let vcode 			  = voteInit.voteAgainVcode;
			let vote_start 		  = $('[p-select="vote-restart"]:checked').val();
			let vote_start_input  = $('[p-select="vote_re_start_input"]').val();
			let vote_limit_minute = $('[p-select="vote_re_limit_minute"]').val();
			let vote_participants = $('[p-select=vote_re_participants]').val();
			let participants 	  = []
			try{
				vote_participants = JSON.parse(vote_participants);
				for(let i of vote_participants) {
					participants.push(i.value);
				}
			}catch(e){}

			if(participants.length == 0) {
				return customAlert('1021');
			}

			if(vote_start == 't2' && (vote_start_input == null || vote_start_input.trim() == '' || moment(vote_start_input).isValid() == false)) {
				return customAlert('1025');
			}

			let confirm = await customConfirm('1049');

			if(confirm == true) {
				$.ajax({
					beforeSend: beforeSend,
					url : '/vote/againVote',
					type : 'POST',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						ccode:confCode,
						vcode: vcode,
						vote_start: vote_start,
						vote_start_input: vote_start_input,
						vote_limit_minute: vote_limit_minute,
						participants: participants
					}),
					success: function(data) {
						voteInit.getVoteList();
						hidePopup($('.js-popup-re-vote'));
						voteInit.resetVoteDetail();
					},
					error: function(e) {
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
					}
					}
				});
			}
		},

		voteEdit: (vcode) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getDetail',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode,
					vcode: vcode
				}),
				success: function(data) {
					voteInit.setVoteModify(data);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		setVoteModify: (data) => {
			let result = data.result;

			voteInit.resetVoteCreate();
			$('[p-select="vote_layer1"]').hide();
			$('[p-select="vote_layer2"]').show();

			$('[p-select=vote_title]').val(result.title);
			$('[p-select=vote_content]').prev().html(result.contents)

			$('[p-select="vote-title"]').text(_spl('modifyVote'));
			$('[p-select="create-vote"]').text(_spl('modifyBtn'));
			$('[p-select="create-vote"]').attr('type', 'modify');
			$('[p-select="create-vote"]').attr('p-vcode', result.vcode);

			typpeInit.hideAllTyppy();

			$('.js-popup-added-vote').attr('type', 'edit');
			showPopup($('.js-popup-added-vote'));
		},

		voteDetail: (vcode, th) => {
			$(th).closest('.messages__list').children('.messages__item').removeClass('active');
			$(th).addClass('active');

			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getDetail',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode,
					vcode: vcode
				}),
				success: function(data) {
					voteInit.setVoteDetail(data);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},
		// 복사
		voteCopy: async (vcode) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/vote/getDetail',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode,
					vcode: vcode
				}),
				success: function(data) {
					showPopup($('.js-popup-added-vote'))

					let result = data.result;
					let defValus = $('[p-select="vote-participants"]')[0].tagify.settings.whitelist;
					let defValueMap = {};
					let setParticipants = [];

					for(let i of defValus) {
						defValueMap[i.value] = i;
					}

					voteInit.resetVoteCreate();
					$('[p-select=vote_title]').val(result.title);
					$('[p-select=vote_content]').prev().html(result.contents)
					$(`[p-select="vote-type1"][value="${result.item_type}"]`).prop("checked", true).trigger('change');

					for(let i=0, iLen=result.list.length; i<iLen; i++){
						if(i != 0) {
							$(`[p-select="vote_${result.item_type}_field"] a.button.header__button.plus`).eq(i-1).trigger('click');
						}

						$(`[p-select="vote_${result.item_type}_field"] .field__input.field_text`).eq(i).val(result.list[i].c);
						
						
						
					}
					// $(`[p-select="vote_t1_field"].vote__type.t1.active`).find('.conference__row').slice(-2).remove();
					$(`[p-select="vote_t1_field"].vote__type.t1.active`)
					.find('.conference__row')
					.slice(-2)
					.filter(function() {
						let input = $(this).find('input');
						return input.length > 0 && (input.val() === "반대" || input.val() === "기권");
					})
					.remove();
					
					$('[p-select=vote_limit_minute]').val(result.limit_time).niceSelect('update');

					for(let i in result.participants) {
						setParticipants.push(defValueMap[i]);
					}

					$('[p-select="vote-type2"]').prop("checked", result.anonymous);
					$('[p-select="vote-type3"]').prop("checked", result.multiple);

					$('[p-select="vote-participants"]').val(JSON.stringify(setParticipants));
					$('.js-popup-added-vote').attr('type', 'edit');
					showPopup($('.js-popup-added-vote'))
					typpeInit.hideAllTyppy();
				},
				error: function(e) {
					typpeInit.hideAllTyppy();
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		voteDelete: async (vcode) => {
			let confirm = await customConfirm('1041');

			if(confirm == true) {
				$.ajax({
					beforeSend: beforeSend,
					url : '/vote/deleteVote',
					type : 'POST',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						ccode:confCode,
						vcode: vcode
					}),
					success: function(data) {
						voteInit.resetVoteDetail();
						voteInit.getVoteList();
						typpeInit.hideAllTyppy();
						// checkAndUpdateVoteList(data.result);
					},
					error: function(e) {
						typpeInit.hideAllTyppy();
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
					}
					}
				});
			}
		},

		createVote: () => {
			let vote_title = $('[p-select=vote_title]').val();
			let vote_content = $('[p-select=vote_content]').val();
			let vote_type = $('[p-select=vote-type1]:checked').val();
			let vote_t1_field = $('[p-select=vote_t1_field]').find('.field_text');
			let vote_t2_field = $('[p-select=vote_t2_field]').find('.field_text');
			let vote_t3_field = $('[p-select=vote_t3_field]').find('.field_text');
			let vote_type2 = $('[p-select=vote-type2]').is(':checked');
			let vote_type3 = $('[p-select=vote-type3]').is(':checked');
			let vote_start = $('[p-select=vote-start]:checked').val();
			let vote_start_input = $('[p-select=vote_start_input]').val();
			let vote_limit_minute = $('[p-select=vote_limit_minute]').val();
			let vote_added_time = $('[p-select=vote_added_time]').val();
			let vote_participants = $('[p-select=vote-participants]').val();
			let participants = []
			let vote_field_contents = [];
			let vote_field = null;
			let extractTextPattern = /(<([^>]+)>)/gi;
			let vote_content_str = vote_content.replace(extractTextPattern, '');
			let type = $('[p-select="create-vote"]').attr('type');
			let vcode = $('[p-select="create-vote"]').attr('p-vcode');

			if(type == null || type == 'create') {
				try{
					vote_participants = JSON.parse(vote_participants);
					for(let i of vote_participants) {
						participants.push(i.value);
					}
				}catch(e){}

				switch(vote_type) {
					case 't1' :
						vote_field = vote_t1_field;
					break;

					case 't2' :
						vote_field = vote_t2_field;
					break;

					case 't3' :
						vote_field = vote_t3_field;
					break;
				}

				for(let i of vote_field) {
					if($(i).val() == null || $(i).val().trim() == '') {
						return customAlert('1017');
					}
					vote_field_contents.push($(i).val());
				}

				if(vote_title == null || vote_title.trim() == '' ) {
					return customAlert('1018');
				}

				if(vote_field_contents.length == 0) {
					return customAlert('1020');
				}

				if(participants.length == 0) {
					return customAlert('1021');
				}

				if(vote_start == 't2' && (vote_start_input == null || vote_start_input.trim() == '' || moment(vote_start_input).isValid() == false)) {
					return customAlert('1025');
				}

				$.ajax({
					beforeSend: beforeSend,
					url : '/vote/createVote',
					type : 'POST',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						vote_title:vote_title,
						vote_content:vote_content,
						vote_type:vote_type,
						vote_field_contents:vote_field_contents,
						vote_type2:vote_type2,
						vote_type3:vote_type3,
						vote_limit_minute:vote_limit_minute,
						participants:participants,
						vote_start:vote_start,
						vote_start_input:vote_start_input,
						confCode:confCode
					}),
					success: function(data) {
						let vcode = data.result;
						voteInit.resetVoteCreate();
						voteInit.resetVoteDetail();
						hidePopup($('.js-popup-added-vote'));
						voteInit.getVoteList();
					},
					error: function(e) {
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
					}
					}
				});
			}else if(type == 'modify') {
				if(vote_title == null || vote_title.trim() == '' ) {
					return customAlert('1018');
				}

				$.ajax({
					beforeSend: beforeSend,
					url : '/vote/editVote',
					type : 'POST',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify({
						vote_title:vote_title,
						vote_content:vote_content,
						vote_added_time:vote_added_time,
						vcode:vcode,
						confCode:confCode
					}),
					success: function(data) {
						voteInit.resetVoteCreate();
						voteInit.resetVoteDetail();
						hidePopup($('.js-popup-added-vote'));
						voteInit.getVoteList();
					},
					error: function(e) {
						if(e?.responseJSON?.errorCode == 'auth_failed') {
							customAlert('1098');
							parent.location.href = '/';
						}
						let message = e?.responseJSON?.message;
						if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
						else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
							window.loc = true;
							alert(message);
							return location.href='/';
					}
					}
				});
			}
		},

		showVoteResult: (vcode) => {
			if(vcode == null) {
				vcode = $('[p-select="alarm-end-vote"]').attr('p-data');
			}
			window.open(`/voteResult?vcode=${vcode}`);
		},

		showVoteParti: (vcode) => {
			if(vcode == null) {
				vcode = $('[p-select="alarm-vote"]').attr('p-data');
			}
			voteInit.autoOpenPvote = true;
			showPopup($('.js-popup-vote'));
			voteInit.voteDetail(vcode);
		},

		alarmVotePopup: (messageCode, vcode, title) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/message',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					code:messageCode
				}),
				success: function(data) {
					let message = data?.result?.message;
					$('[p-select="alaramVoteMessage"]').text(message);
					$('[p-select="alaramVoteName"]').text(title);

					$('[p-select="alarm-vote"]').attr('p-data', vcode);
					showPopup($('.js-popup-alarm-vote'));
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		alarmEndVotePopup: (messageCode, vcode, title) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/message',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					code:messageCode
				}),
				success: function(data) {
					let message = data?.result?.message;
					$('[p-select="alaramEndVoteMessage"]').text(message);
					$('[p-select="alaramEndVoteName"]').text(title);

					$('[p-select="alarm-end-vote"]').attr('p-data', vcode);
					showPopup($('.js-popup-alarm-endvote'));

					$('[p-select="alarm-end-vote"]').text();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		resetVoteCreate: () => {
			$('[p-select=vote_title]').val('');
			$('[p-select=vote_content]').prev().html('')
			$('[p-select=vote_t1_field] > .conference__row').not(':first').remove();
			$('[p-select=vote_t2_field] > .conference__row').not(':first').remove();
			$('[p-select=vote_t3_field] > .conference__row').not(':first').remove();

			// $('[p-select=vote_t1_field] .field_text').val('');
			// 기본 투표 항목(찬성, 반대, 기권) 추가
			$('[p-select=vote_t1_field]').empty();
			voteInit.addVoteField(null, 't1');
			$('[p-select=vote_t1_field] .field_text').eq(0).val('찬성');
			voteInit.addVoteField(null, 't1');
			$('[p-select=vote_t1_field] .field_text').eq(1).val('반대');
			voteInit.addVoteField(null, 't1');
			$('[p-select=vote_t1_field] .field_text').eq(2).val('기권');


			$('[p-select=vote_t2_field] .field_text').val('');
			$('[p-select=vote_t3_field] .field_text').val('');
			$('[p-select="vote_start_input"]').val('');

			// 익명투표 복수투표 체크상태
			$('[p-select="vote-type1"][value="t1"]').prop("checked", true).trigger('change');
			$('[p-select="vote-type2"], [p-select="vote-type3"]').prop("checked", false);
			$('[p-select="vote-start"][value="t0"]').prop("checked", true).trigger('change');
			$('[p-select=vote_limit_minute]').val('5').niceSelect('update');

			try{
				$('[p-select="vote-participants"]')[0].tagify.removeAllTags();
			}catch(e){}


			$('[p-select="vote-title"]').text(_spl('createVote'));
			$('[p-select="create-vote"]').text(_spl('createBtn'));
			$('[p-select="create-vote"]').attr('type', 'create');
			$('[p-select="create-vote"]').removeAttr('p-vcode');
			$('[p-select="vote_layer1"]').show();
			$('[p-select="vote_layer2"]').hide();
			$('[p-select=vote_added_time]').val('5').niceSelect('update');
		},

		getParticipant: (callee, select) => {
			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/getParticipant',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					confCode: confCode
				}),
				success: function(data) {
					callee(data?.result, select);
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});
		},

		addVoteField: (th, type) => {
			let tag = '';

			if($(th).closest('.vote__type').hasClass('t2') || type == 't2'){
				tag = `<div class="conference__row">
							<div class="conference__label"></div>
							<div class="conference__col">
								<form class="form mr__10 form__search wp__100">
									<input class="field__input pl__40 wp__100 field_text" type="text" p-placeholder="selDate" required="required" autocomplete="off" readonly="readonly" data-popup=".js-popup-schedule">
									<button type="button" class="form__button">
                               		  	<img src="/assets/img/calendar_month.svg" alt="캘린더" viewBox="0 0 32 32" style="width: 32px; height: 32px;">
									</button>
								</form>
								<a class="button header__button pr__10 pl__10 mr__5 red" p-select="vote-field-remove" href="javascript:void(0)">
									<svg class="icon icon-close">
										<use xlink:href="#icon-close"></use>
									</svg>
								</a>
								<a class="button header__button pr__10 pl__10 plus" p-select="vote-field-add" href="javascript:void(0)">
									<svg class="icon icon-add">
										<use xlink:href="#icon-add"></use>
									</svg>
								</a>
							</div>
						</div>`;
			}else{
				tag = `<div class="conference__row">
							<div class="conference__label"></div>
							<div class="conference__col">
								<input type="text" class="field__input field_text" p-placeholder="enterVoteItem" style="margin-right:10px;">
								<a class="button header__button pr__10 pl__10 mr__5 red" p-select="vote-field-remove" href="javascript:void(0)">
									<svg class="icon icon-close">
										<use xlink:href="#icon-close"></use>
									</svg>
								</a>
								<a class="button header__button pr__10 pl__10 plus" p-select="vote-field-add" href="javascript:void(0)">
									<svg class="icon icon-add">
										<use xlink:href="#icon-add"></use>
									</svg>
								</a>
							</div>
						</div>`;
			}
			if(th == null && type != null) {
				if(type == 't1') {
					$('[p-select="vote_t1_field"]').append(tag);
					// $('[p-select="vote_t1_field"]').find('[p-select="vote-field-remove"]').remove();
				}else if(type == 't2') {
					$('[p-select="vote_t2_field"]').append(tag);
					$('[p-select="vote_t2_field"]').find('[p-select="vote-field-remove"]').remove();
					dataPopupBind();
					common.datePickerBind();
				}else if(type == 't3') {
					$('[p-select="vote_t3_field"]').append(tag);
					$('[p-select="vote_t3_field"]').find('[p-select="vote-field-remove"]').remove();
				}
			}else{
				$(tag).insertAfter($(th).closest('.conference__row'));

				if($(th).closest('.vote__type').hasClass('t2')){
					dataPopupBind();
					common.datePickerBind();
				}
			}

			$('[p-select="vote-field-remove"]').off('click').on('click', function() {
				voteInit.removeVoteField(this);
			});

			$('[p-select="vote-field-add"]').off('click').on('click', function() {
				voteInit.addVoteField(this);
			});
		},

		removeVoteField: async (th) => {
			let val = $(th).closest('.conference__col').find(".field_text").val();
			let confirm = true;

			if(val != null && val.trim() != '') {
				confirm = await customConfirm('1015');
			}

			if(confirm == true) {
				$(th).closest('.conference__row').remove();
			}
		}
	};

	window.whiteboardInit = {
		drawType: 'conference',
		drawTimeOut: null,
		myDrawData: {},
		presenterDeawData: {},
		drawBuffer: [],
		init: () => {
			$('#whiteboardContainer').on('whiteboardSend', function(content) {
				if(content.t =='cursor') return;

				let w = $('#whiteboard__layer').width();
				let h = $('#whiteboard__layer').height();

				let pw = $('#viewer > .page').eq(0).width();
				let ph = $('#viewer > .page').eq(0).height();

				content['w'] = w;
				content['h'] = h;
				content['pw'] = pw;
				content['ph'] = ph;
				
				if(permissionDoc.indexOf(currUcode) > -1) {
					socketInit.io.emit("drawToWhiteboard", {content: content, confCode: confCode});
				}
			});

			$('#whiteboardContainer').on('whiteboardMouseUp	', function() {
				if(permissionDoc.indexOf(currUcode) > -1) {
					whiteboardInit.saveWhiteboard('presenter');
				}else if(conferenceInit.mode.seminar == false){
					//whiteboardInit.saveWhiteboard('user');
				}
			});
		},

		setCanvasSize: () => {
			console.log('setCanvasSize');
			whiteboard.clearWhiteboard();
			whiteboardInit.setSize();
			try {
				const canvas = whiteboard.canvas;
				const pageEl = document.querySelector('#viewer > .page');
				const rect = pageEl.getBoundingClientRect(); // 브라우저 상의 실제 크기
			
				// ✅ 실제 그릴 해상도 (고해상도 디스플레이 대응 가능)
				canvas.width = rect.width;
				canvas.height = rect.height;

				// ✅ 렌더링 크기도 함께 설정
				canvas.style.width = `${rect.width}px`;
				canvas.style.height = `${rect.height}px`;
			
				const drawData =
				  whiteboardInit.presenterDeawData?.[PDFViewerApplication.baseUrl]?.[PDFViewerApplication.page]?.[whiteboardInit.drawType];
			
				if (!drawData || !drawData.buffer) return;
			
				const whiteboardBuff = JSON.parse(JSON.stringify(drawData.buffer));
				// const originalWidth = drawData.pw || rect.width;
				const originalWidth = drawData.pw || rect.width;
				const originalHeight = drawData.ph || rect.height;

				// ✅ X, Y 스케일을 따로 계산
				const scaleX = rect.width / originalWidth;
				const scaleY = rect.height / originalHeight;
			
				const scaleRatio = rect.width / originalWidth;
			
				for (let i = 0; i < whiteboardBuff.length; i++) {
				  const d = whiteboardBuff[i].d;
				  whiteboardBuff[i].th = whiteboardBuff[i].th * ((scaleX + scaleY) / 2); // 두 축 평균값
				  //whiteboardBuff[i].th = whiteboardBuff[i].th * scaleRatio;

				  	for (let j = 0; j < d.length; j += 2) {
						d[j] = d[j] * scaleX;     // x
						d[j + 1] = d[j + 1] * scaleY; // y
					}
				}
			
				if (whiteboard.drawBuffer.length !== whiteboardBuff.length) {
				  setTimeout(() => {
					console.log('whiteboard.loadData');

					whiteboard.loadData(whiteboardBuff);
				  }, 100);
				}

			  } catch (e) {
				console.error('❌ setCanvasSize error:', e);
			  }
		},

		setSize: () => {
			console.warn('setSize');
			if(mousePointUse == true) documentInit.setDocumentMouseMark();
			defaultInit.getPresenterInfo();

			setTimeout(function(){
				let w = $('#viewer > .page').width();
				let h = $('#viewer > .page').height();

				if(window.whiteboardInit != null && window.whiteboardInit.drawBuffer != null && window.whiteboardInit.drawBuffer[window.whiteboardInit.drawBuffer.length-1] != null) {
					let drawBuffer = window.whiteboardInit.drawBuffer[window.whiteboardInit.drawBuffer.length-1];
					w = drawBuffer.w;
					h = drawBuffer.h;
				}

				let tw = $('#viewer .page').width();
				let th = $('#viewer .page').height();
				console.warn('whiteboard__layer Size1');
				$('#whiteboard__layer').css({
					'width':`${tw}px`,
					'height':`${th}px`,
					'left': '50%',
					'top':'unset',
					'aa':'vv',
					'transform': 'translate(-50%, 0%)'
				});
			}, 100)
		},
		
		setDrawWithoutFetch: () => {
			console.log('🎯 setDrawWithoutFetch (resize 전용)');
		
			if (whiteboardInit.drawTimeOut != null) {
				clearTimeout(whiteboardInit.drawTimeOut);
			}
		
			whiteboard.clearWhiteboard();
		
			whiteboardInit.drawTimeOut = setTimeout(() => {
				try {
					let buffer = whiteboardInit.drawBuffer || [];

					// ✅ 캔버스 크기 먼저 설정
					whiteboardInit.setCanvasSize();		
					// ✅ 발표자일 경우에만 참석자에게 redraw 요청
					if (permissionDoc.includes(currUcode)) {
						console.log('🟡 발표자가 전송한 drawBuffer length:', buffer.length);
						
						socketInit.io.emit("drawWithoutFetch", { 
							confCode: confCode, 
							content: buffer
						});
					}

					whiteboardInit.drawTimeOut = null;
				} catch (e) {
					console.warn('❌ setDrawWithoutFetch 실패:', e);
					whiteboard.clearWhiteboard();
				}
			}, 300);
		},
		
		

		getWhiteboard: () => {
			console.trace("################  getWhiteboard ###############");
			let deferred = $.Deferred();
			$.ajax({
				beforeSend: beforeSend,
				url : '/conference/blackboard/getData',
				type : 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({
					ccode:confCode,
					pdfName: PDFViewerApplication.baseUrl,
					page: PDFViewerApplication.page,
				}),
				success: function(data) {
					data = data.result;
					
					for(let i of data) {
						let data = i.data;
						let ucode = i.ucode;
						let saveType = i.saveType;
						let pdfName = i.pdfName;
						let page = i.page;
						let h = i.h;
						let w = i.w;
						let ph = i.ph;
						let pw = i.pw;
						
						if(saveType == whiteboardInit.drawType) {
							if(whiteboardInit.presenterDeawData[pdfName] == null) whiteboardInit.presenterDeawData[pdfName] = {};
							if(whiteboardInit.presenterDeawData[pdfName][page] == null) whiteboardInit.presenterDeawData[pdfName][page] = {};
							whiteboardInit.presenterDeawData[pdfName][page][whiteboardInit.drawType] = {ph: ph, pw:pw, buffer:[]};
							whiteboardInit.presenterDeawData[pdfName][page][whiteboardInit.drawType]['buffer'] = data;
							// 이걸 해줘야 하나..
						}
					}
					deferred.resolve();
				},
				error: function(e) {
					if(e?.responseJSON?.errorCode == 'auth_failed') {
						customAlert('1098');
						parent.location.href = '/';
					}
					let message = e?.responseJSON?.message;
					if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
					else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
						window.loc = true;
						alert(message);
						return location.href='/';
				}
				}
			});

			return deferred.promise();
		},

		clear: () => {
			console.warn('clear');
			whiteboard.clearWhiteboard();
		},

		setDraw: () => {
			console.trace('[TRACE] setDraw() 호출됨');
			if(whiteboardInit.drawTimeOut != null ) {
				clearTimeout(whiteboardInit.drawTimeOut);
			}
			whiteboard.clearWhiteboard();
			whiteboardInit.drawTimeOut = setTimeout(async () => {
				
				
				try{
					await whiteboardInit.getWhiteboard();

					const baseUrl = PDFViewerApplication.baseUrl;
      				const page = PDFViewerApplication.page;
      				const drawType = whiteboardInit.drawType;

					const drawData =  whiteboardInit.presenterDeawData?.[baseUrl]?.[page]?.[drawType];
			  
					const buffer = drawData?.buffer || [];
			  
					whiteboardInit.drawBuffer = JSON.parse(JSON.stringify(buffer));

					whiteboardInit.setCanvasSize();

					if (buffer.length > 0) {
						whiteboardInit.safeDrawToWhiteboard(() => {
						  socketInit.events.whiteboard.drawToWhiteboard(buffer[buffer.length - 1]);
						});
					}

				} catch (e) {
					console.error('❌ setDraw error:', e);
					whiteboard.clearWhiteboard();
				  } finally {
					whiteboardInit.drawTimeOut = null;
				  }
				}, 500);
		},

		safeDrawToWhiteboard: function(drawFn, retry = 0) {
			console.warn('⚠️ safeDrawToWhiteboard');
			const MAX_RETRY = 10;
			const canvas = whiteboard?.canvas;
			const pageEl = document.querySelector('#viewer > .page');
		
			if (!canvas || !pageEl) {
				console.warn('🚫 whiteboard canvas or page element not found');
				return;
			}
		
			const rect = canvas.getBoundingClientRect();
			const pageRect = pageEl.getBoundingClientRect();
		
			const isReady = rect.width > 10 && rect.height > 10 &&
							pageRect.width > 10 && pageRect.height > 10;
		
			if (isReady) {
				drawFn();
			} else if (retry < MAX_RETRY) {
				requestAnimationFrame(() => {
					whiteboardInit.safeDrawToWhiteboard(drawFn, retry + 1);
				});
			} else {
				console.warn('⚠️ canvas position not ready after retries, force drawing anyway');
				drawFn();
			}
		},

		saveWhiteboard: async (type) => {
			for(let i of whiteboard.drawBuffer) {
				delete i.username;
			}
			
			const base64 = $('#whiteboardCanvas')[0].toDataURL();
			const img = new Image();
			img.src = base64;

			const canvas = document.createElement("canvas");
			const context = canvas.getContext("2d");
			canvas.width = $('#viewer > .page').width();
			canvas.height = $('#viewer > .page').height();

			img.onload = function() {
			    const croppedWidth = canvas.width;
			    const croppedHeight = canvas.height;
			    let topGap = $('.canvasWrapper').offset().top - $('#whiteboardCanvas').offset().top;
			    let leftGap = $('.canvasWrapper').offset().left - $('#whiteboardCanvas').offset().left;

			    const croppedX = leftGap < 0 ? 0 : leftGap;
			    const croppedY = topGap < 0 ? 0 : topGap;
			    context.drawImage(img, croppedX, croppedY, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
			    const croppedBase64String = canvas.toDataURL();
				
			    $.ajax({
			    	beforeSend: beforeSend,
			    	url : '/conference/blackboard/save',
			    	type : 'POST',
			    	contentType: 'application/json; charset=utf-8',
			    	data: JSON.stringify({
			    		ccode:confCode,
			    		pdfName: PDFViewerApplication.baseUrl,
			    		page: PDFViewerApplication.page,
			    		data: whiteboard.drawBuffer,
			    		type: type,
			    		base64: croppedBase64String,
			    		w: $(window).width(),
			    		h: $(window).height(),
			    		pw: $('#whiteboard__layer').width(),
			    		ph: $('#whiteboard__layer').height()
			    	}),
			    	success: function(data) {
						whiteboardInit.getWhiteboard();

						if(permissionDoc.indexOf(currUcode) > -1) {
							socketInit.io.emit("userGetWhiteboardData", {confCode: confCode});
						}
			    	},
			    	error: function(e) {
			    		if(e?.responseJSON?.errorCode == 'auth_failed') {
			    			customAlert('1098');
			    			parent.location.href = '/';
			    		}
			    		let message = e?.responseJSON?.message;
			    		if( message && message != '1016' && e?.responseJSON?.errorCode != '1016' ) return alert(message);
			    		else if((message == '1016' || e?.responseJSON?.errorCode == '1016') && window.loc == null) {
			    			window.loc = true;
			    			alert(message);
			    			return location.href='/';
			    	}
			    	}
			    });
			};
		}
	}


	window.socketInit = {
		firstLoad: false,
		io: io(`/socket?ccode=${confCode}`),
		events : {
			users: {
				userConnection: (data) => {
					userInit.setUserTag(data);
					userInit.setChatUserTag(data);
					typpeInit.setUserTyppy();
				},
				userDisconnection: (data) => {
					userInit.disconnectUser(data.ucode);
				},
				allUsers: (data) => {
					userInit.allUsers(data);
				},
				conferenceUserExit: () => {
					location.href = '/?forcedExit=true';
				},
				getPresenterInfo: () => {
					if(permissionDoc.indexOf(currUcode) > -1) {
						let pw = $('#viewer > .page').width();
						let ph = $('#viewer > .page').height();

						socketInit.io.emit('setPresenterInfo', { confCode: confCode, pw: pw, ph: ph, pdf: PDFViewerApplication.baseUrl.replace('/pdfs/', '')});
					}
				},
				setPresenterInfo: (data) => {
					if(permissionDoc.indexOf(currUcode) == -1) {
						presenterInfo = data;
					}
				}
			},
			conference: {
				setPointerMode: (data) => {
					if(permissionDoc.indexOf(currUcode) == -1) {
						if(data.pointer == false) {
							//$('.viewer-mark').removeClass('show');
							documentInit.setDocumentMouseMarkShowHide('hide');
							conferenceInit.mode.pointer = false;
						}else{
							//$('.viewer-mark').addClass('show');
							documentInit.setDocumentMouseMarkShowHide('show');
							conferenceInit.mode.pointer = true;
						}
					}
				},
				getSyncData: async (data) => {
					if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.sync == true) {
						if(data.pdf != null && PDFViewerApplication.baseUrl != null && data.pdf != PDFViewerApplication.baseUrl.replace('/pdfs/', '')){
							PDFViewerApplication.baseUrl = data.pdf;
						}

						if(data.page != null && data.page != PDFViewerApplication.page) {
							PDFViewerApplication.page = data.page;
						}

						if(data.zoom == null) PDFViewerApplication.pdfViewer.currentScaleValue = defaultZoom;
						else PDFViewerApplication.pdfViewer.currentScaleValue = data.zoom;
					}
				},
				setUserSyncSetting: async () =>{
					conferenceInit.userSyncSetting();
				},
				setViewerScroll: async (data) => {
					if(permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.sync == true) {
						var t = data.t;
						var h = data.h;
						var vh = $('#viewer').height();

						var s1 = vh/h*100;
						var s2 = t*s1/100;
						
						$('#viewerContainer').scrollTop(s2).data('removeScroll', 'true');
						
						var x = data.x;
						var w = data.w;
						var vw = $('#viewer').width();

						var s3 = vw/w*100;
						var s4 = x*s3/100;
						$('#viewerContainer').scrollLeft(s4).data('removeScroll', 'true');
						return false;
					}
				},
				getStatus: async (data) => {
					if(data?.type == 'first') {
						if(data?.pdf != null) {
							$('[p-select="document-list"]').data('firstLoad', 'true');
							$('[p-select="document-list"]').val(data.pdf).trigger('change').niceSelect('update');
						}else{
							const pdf = $('[p-select="document-list"] option:first').val();
							documentInit.changePdf(pdf, 1, false);
						}
						conferenceInit.mode.blackboard = data.blackboard;
						conferenceInit.mode.page = data.page;
						conferenceInit.mode.pdf = data.pdf;
						conferenceInit.mode.screenShare = data.screenShare;
						conferenceInit.mode.seminar = data.seminar;
						conferenceInit.mode.sync = data.sync;
						conferenceInit.mode.type = data.type;
						conferenceInit.mode.pointer = (data.pointer != null && data.pointer.check == true ? true:false);
					}else if(data?.type == 'disconnection') {
						conferenceInit.mode.blackboard = data.blackboard;
						conferenceInit.mode.screenShare = data.screenShare;
						conferenceInit.mode.seminar = data.seminar;
						conferenceInit.mode.sync = data.sync;
					//}
					}else{
						conferenceInit.mode.blackboard = data.blackboard;
					}

					if(data.blackboard == true) {
						$('[p-select="btn-blackboard"]').addClass('checked');
						
						if((permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.sync == true) || data?.type == 'first') {
							$('body').attr('blackboard-mode', 'true');
							$('#whiteboard__layer').addClass('show');
							$('[p-select="btn-blackboard"]').addClass('checked');
							$('[p-select="whiteboard-util"]').addClass('active');
							
							await whiteboardInit.setDraw();
						} 

						PDFViewerApplication.pdfViewer.scrollMode = 3;

					}else{

						if( (permissionDoc.indexOf(currUcode) == -1 && conferenceInit.mode.sync == true) || data?.type == 'first') {
							$('body').removeAttr('blackboard-mode');
							$('#whiteboard__layer').removeClass('show');
							$('[p-select="btn-blackboard"]').removeClass('checked');
							$('[p-select="whiteboard-util"]').removeClass('active');
						}
						PDFViewerApplication.pdfViewer.scrollMode = 3;
					}

					if(data.screenShare == true) {
						$('[p-select="btn-screen-share"]').addClass('checked');
						if(permissionDoc.indexOf(currUcode) == -1) {
							viewerObj.stop();
							viewerObj.registerNodeEvents();
							callee();
						}
					}else{
						$('[p-select="btn-screen-share"]').removeClass('checked');
					}

					if(data.seminar == true) {
						$('[data-popup=".js-popup-document"]').attr('disabled', 'disabled');
						$('[p-select="util-page"]').attr('readonly', 'readonly');
						$('[p-select="btn-seminar"]').addClass('checked');
					}else{
						$('[data-popup=".js-popup-document"]').removeAttr('disabled');
						$('[p-select="util-page"]').removeAttr('readonly');
						$('[p-select="btn-seminar"]').removeClass('checked');
					}

					if( (data.sync == true && data.seminar == false && permissionDoc.indexOf(currUcode) == -1) ||
						(data.sync == true && data.seminar == true)
					){
						$('[p-select="btn-user-sync"]').addClass('checked');
					$('[p-select="fv-btn-sync"]').addClass('checked');
					$('[p-select="fv-btn-blackboard"]').css('display', 'none');
					$('[p-select="whiteboard-util"]').removeClass('active');
					
					}else{
						$('[p-select="btn-user-sync"]').removeClass('checked');
						$('[p-select="fv-btn-sync"]').removeClass('checked');
						$('[p-select="fv-btn-blackboard"]').css('display', '');
						$('[p-select="whiteboard-util"]').addClass('active');
						
					}


					if( (data.pointer != null && data.pointer.check == false) || data.pointer == null ) {
						//$('.viewer-mark').removeClass('show');
						documentInit.setDocumentMouseMarkShowHide('hide');
						$('[p-select="pointer"]').removeClass('active');
						$('[p-select="mouse-mark-box"]').addClass('hide');
					}else{
						//$('.viewer-mark').addClass('show');
						documentInit.setDocumentMouseMarkShowHide('show');
						$('[p-select="pointer"]').addClass('active');
						$('[p-select="mouse-mark-box"]').removeClass('hide');
						setTimeout(function(){
							documentInit.setMarkPosition(data.pointer);
						}, 1500);
					}

					conferenceInit.setInfo();
				},

				userSyncSetting: (data) => {
					let pdf 	= data.pdf;
					let page 	= data.page || 1;
					let zoom	= data.zoom;

					if(pdf != null) {
						$('#viewerContainer').data('removeScroll', 'only');

						if(PDFViewerApplication.baseUrl != `/pdfs/${pdf}`) {
							PDFViewerApplication.pdfViewer.textLayerMode = 0;
							PDFViewerApplication.preferences.set('sidebarViewOnLoad', 0);

							PDFViewerApplication.open('/pdfs/' + pdf).then(function() {
								PDFViewerApplication.pdfViewer.currentScaleValue = defaultZoom;
								setTimeout(function(){
									documentInit.setPdf({type: "sync", currPage: page, zoom: zoom, data: data, pdf: pdf});
								}, 400);
							}).catch(function(e){
								// customAlert('2077');
								$('[p-select="conf-loading2"]').hide();
							});
						}else{
							documentInit.setPdf({type: "sync", currPage: page, zoom: zoom, data: data, pdf: pdf});
						}
					}
					if(permissionDoc.indexOf(currUcode) == -1 && $('[p-select="live-streaming-box"]').hasClass('show') == false) {
						socketInit.io.emit('livestreamingGetInfo', { confCode: confCode});
					}
				},
				requestFullscreen: (data) => {
					const isPresenter = permissionDoc.indexOf(currUcode) > -1;
					const isParticipantFullscreen = $('body').hasClass('fv'); // 참여자 현재 상태
				  
					if (isPresenter) return; // 발표자는 수신 무시

					console.log('requestFullScreen: ', data);

					// 발표자가 fullscreen 진입
					if ( data.fullscreen === true && isParticipantFullscreen === false) {
						conferenceInit.showFullscreenPrompt(); // 버튼 보여줌
					}else if ( 
						// 발표자가 fullscreen 해제 → 참여자도 해제
					  	data.fullscreen === false && isParticipantFullscreen === true) {
					  	defaultInit.toggleFullScreen(); // 일반 화면으로 복귀
					}else { 
						// 발표자와 이미 상태가 같으면 버튼 무조건 제거
						conferenceInit.hideFullscreenPrompt(); // 혹시 떠 있으면 숨김
					}
				},
				  

				
				  
				requestPresenter: (data) => {
					$('[p-select="pr-name"]').text(data.name);

					if(data.type == 'presenter') {
						$('[p-select="request-title"]').text(_spl('requestPresenter'));
						$('[p-select="request-auth"]').text(_spl('presenterPermission'));
						$('[p-select="request-auth2"]').text(_spl('transferPresenterWant'));
					}else if(data.type == 'document') {
						$('[p-select="request-title"]').text(_spl('requestDoc'));
						$('[p-select="request-auth"]').text(_spl('docPermission'));
						$('[p-select="request-auth2"]').text(_spl('grantDocWant'));
					}else if(data.type == 'speaker') {
						$('[p-select="request-title"]').text(_spl('requestVoice'));
						$('[p-select="request-auth"]').text(_spl('voicePermission'));
						$('[p-select="request-auth2"]').text(_spl('grantVoiceWant'));
					}

					$('[p-select="pr-allow"]').off('click').on('click', function(){
						hidePopup($('.js-popup-presenter-request'));

						if(data.type == 'presenter'){
							conferenceInit.setPresenterAuth(data.userUcode);
						}else if(data.type == 'document'){
							conferenceInit.setAuthDocument(data.userUcode, 'auth');
						}else if(data.type == 'speaker'){
							conferenceInit.setAuthVoice(data.userUcode, 'auth');
						}
					});

					$('[p-select="pr-deny"]').off('click').on('click', function(){
						socketInit.io.emit('requestPresenterResult', { confCode: confCode, userUcode: data.userUcode, value: 'deny'});
						hidePopup($('.js-popup-presenter-request'));
					});

					showPopup($('.js-popup-presenter-request'));
				},
				requestPresenterResult: (data) => {
					if(data.value == 'deny') {
						alarmInit.showToast(_spl('declineRequest'), 'bottom-right', 'error');
					}
				},

				changePresenter: async (data) => {
					typpeInit.hideAllTyppy();
					await conferenceInit.getPresenter();
					socketInit.io.emit('allUsers', {ccode: confCode});
					conferenceInit.setInfo();
					conferenceInit.setSyncButton();

					if(conferenceInit.mode.blackboard == true) {
						whiteboardInit.setDraw();
					}
					if(data != null && data.type == 'disconnection') {
						conferenceInit.getStatus('disconnection');
					}

					defaultInit.setChangeUserVolum('change');
					$('[p-select="btn-screen-share"]').removeClass('checked');

					if(permissionDoc.indexOf(currUcode) > -1) {
						$('body').addClass('presenter');
						$('[p-select="btn-user-sync"]').removeClass('checked');
						socketInit.io.emit('setUserSyncSetting', {confCode: confCode});
						socketInit.io.emit('changePdf', {pdf: PDFViewerApplication.baseUrl.replace('/pdfs/', ''), confCode: confCode});

						defaultInit.setDefaultMode();
						conferenceInit.setStatus({sync: true});
					}else{
						$('body').removeClass('presenter');
						$('[p-select="btn-user-sync"]').addClass('checked');

						conferenceInit.mode['sync'] = true;
					}

					conferenceInit.setSyncDataInterval();
				},
				getRoomPdf: (data) => {
					console.log("getRoomPdf : ", data);
				},
				setStatus: (data) => {
					conferenceInit.mode = data;
					if(data.pointer != null) conferenceInit.mode.pointer = data.pointer.check;
					conferenceInit.getStatus('');
				}
			},
			chatting: {
				receiveMessage: (data) => {
					let userUcode 	= data.ucode;
					let name 		= data.name;
					let message 	= data.message;
					let users 		= data.users;
					let photo 		= data.photo;

					chattingInit.createChatTag({
						type: 'opponent',
						name: name,
						ucode: userUcode,
						message: message,
						photo: photo
					});

					if($('.js-popup-chatting').hasClass('visible') == false) {
						if(conferenceInit.setting.chattingAlarm == false) return false;
						alarmInit.showToast(`Chatting : ${common.dots(message, 10)}`, 'bottom-right', 'info', function(){
							showPopup($('.js-popup-chatting'));
						});
					}
				},

				getChattingList: (data) => {
					for (let i = 0, iLen = data.length; i < iLen; i++) {
						let sender 		= data[i].sender;
						let receiver 	= data[i].receiver;
						let message 	= data[i].message;
						let created_at 	= data[i].created_at; //채팅을 생성한 시점시간
						let name 		= data[i].name;
						let users 		= data[i].users;
						let photo 		= data[i].photo;
						console.log("created_at:", created_at, typeof created_at);
						if(photo == null) {
							photo = users[sender].photo;
						}

						if (currUcode == sender) {
							chattingInit.createChatTag({
								type: 'self',
								message: message,
								date: moment(created_at, 'YYYY-MM-DD HH:mm:ss').valueOf(),
								receivers: users,
								ucode: currUcode,
								photo: photo,
								name: name
							});
						} else {
							chattingInit.createChatTag({
								type: 'opponent',
								name: name,
								receiver: receiver,
								message: message,
								date: moment(created_at, 'YYYY-MM-DD HH:mm:ss').valueOf(),
								photo: photo
							});
						}
						$('.conference__chatting .messenger__list').scrollTop($('.conference__chatting .messenger__list').height())
					}
				}
			},
			document: {
				changePdf: (data) => {
					if(permissionDoc.indexOf(currUcode) == -1) {
						conferenceInit.pageChangeCheck = true;
					}

					conferenceInit.remoteChangeCheck = true;
					$('[p-select="document-list"]').val(data.pdf).trigger('change').niceSelect('update');
				},

				updateDocumentList: (data) => {
					if(data.type == 'delete'  && PDFViewerApplication.baseUrl != null && PDFViewerApplication.baseUrl.indexOf(data.filename) > -1) {
						alarmInit.showToast(_spl('documentDeleteMsg'), 'bottom-right', 'warning')
						PDFViewerApplication.close();
					}
					documentInit.getDocumentList('update');
					bookmarkInit.getBookmarkList();
				},

				sendPageChange: (data) => {
					if(permissionDoc.indexOf(currUcode) == -1) {
						conferenceInit.pageChangeCheck = true;
					}
					if(conferenceInit.mode.sync == false) return;

					PDFViewerApplication.page = data.page;
					PDFViewerApplication.pdfViewer.currentScaleValue = data.zoom || defaultZoom;
					if(conferenceInit.mode.blackboard == true) {
						//whiteboardInit.setCanvasSize();
					}
				},

				changeScale: (data) => {
					console.warn('changeScale');
					if(conferenceInit.mode.sync == false) return;
					$('#viewerContainer').data('removeScroll', 'only');
					PDFViewerApplication.pdfViewer.currentScaleValue = data.zoom || defaultZoom;
					//documentInit.setViewerMark();
					if(conferenceInit.mode.blackboard == true) {
						whiteboardInit.setCanvasSize();
					}
				},

				moveViewMark: (data)  => {
					if(conferenceInit.mode.sync == false) return;
					if(permissionDoc.indexOf(currUcode) == -1) {
						documentInit.setMarkPosition(data);
					}
				},

				documentMouseMark: (data) => {
					if(conferenceInit.mode.sync == false) return;
					if(permissionDoc.indexOf(currUcode) == -1) {
						documentInit.setDocumentMouseMarkPosition(data);
					}
				}

			},
			whiteboard: {
				userGetWhiteboardData: () => {
					whiteboardInit.getWhiteboard();
				},
				drawWithoutFetch: () => {
					console.trace("drawWithoutFetch: whiteboardInit.setDrawWithoutFetch ");
					whiteboardInit.setDrawWithoutFetch();
				},
				drawToWhiteboard: (content) => {
					if (permissionDoc.indexOf(currUcode) === -1 && conferenceInit.mode.sync === true) {
						if (!content) return;

						const canvas = document.getElementById('whiteboardCanvas');
						const rect = canvas.getBoundingClientRect();
					
						const actualW = rect.width;
						const actualH = rect.height;
					
						const originalW = content.w || actualW;
						const originalH = content.h || actualH;
					
						const scaleX = actualW / originalW;
						const scaleY = actualH / originalH;
					
						// 좌표 보정
						if (Array.isArray(content.d)) {
							for (let i = 0; i < content.d.length; i += 2) {
								content.d[i] = content.d[i] * scaleX;     // x 좌표
								content.d[i + 1] = content.d[i + 1] * scaleY; // y 좌표
							}
						}
					
						// 선 두께 보정 (가로 기준)
						if (content.th != null) {
							content.th = parseFloat(content.th) * scaleX;
						}
					
						// whiteboard에 그리기
						whiteboard.handleEventsAndData(content, true);					  
					};
				}
				// 기존 drawToWhiteboard 함수는 주석 처리				  
				
			}
		},
		init: async () => {
			for(let i in socketInit.events) {
				for(let j in socketInit.events[i]){
					socketInit.io.on(j, socketInit.events[i][j])
				}
			}

			await conferenceInit.init();
			await chattingInit.init();
			await documentInit.init();
			await memoInit.init();
			await minutesInit.init();
			await bookmarkInit.init();
			await voteInit.init();
			await defaultInit.init();
			await whiteboardInit.init();
			await fileShareInit.init();

			// await liveStreamingInit.init();
			// await voiceInit.init();
			// await screenShareInit.init();

			setTimeout(function(){
				conferenceInit.setSyncButton();
				$('[p-select="conf-loading"]').hide();

				if(PDFViewerApplication.baseUrl != null && PDFViewerApplication.baseUrl.indexOf('empty.pdf') > -1) {
					$('[p-select="document-list"]').val('null').niceSelect('update');
					PDFViewerApplication.close();
				}
			}, 1500);

			if(mousePointUse == true) {
				setInterval(function(){
					if($('#viewer .page').length > 0 && $('#viewer .page').offset() != null) {
						$('[p-select="mouse-mark-box"]').css({
							//'width': `${$('#viewer .page').width()}px`,
							'width': `1px`,
							'height': `${$('#viewer .page').height()}px`,
							'position': 'fixed',
							'top': `${$('#viewer .page').offset().top}px`,
							'left': `${$('#viewer .page').offset().left}px`,
							'z-index': 100
						});
					}
				}, 700);
				setInterval(function(){
					documentInit.setDocumentMouseMark();
				}, 300);
			}else{
				$('[p-select="mouse-mark-box"]').hide();
				$('[p-select="pointer"]').hide();
			}

			documentInit.getDocumentInterval('start');
		},

	}

	socketInit.io.on("connection", async () => {
		if(socketInit.firstLoad == false) {
			await socketInit.init();
			socketInit.firstLoad = true;
		}
		//nwrVoice();

		if(permissionDoc.indexOf(currUcode) == -1) {
			if($('[p-select="btn-user-sync"]').hasClass('checked') == false) {
				$('[p-select="btn-user-sync"]').trigger('click');
			}
		}else{
			$('body').addClass('presenter');
		}
	});

	
});