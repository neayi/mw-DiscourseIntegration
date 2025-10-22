<?php
/*
 * Copyright (c) 2016 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

namespace MediaWiki\Extension\DiscourseIntegration;

use ApiBase;
use ApiMessage;
use ApiMain;
use Wikimedia\ParamValidator\ParamValidator;

use SMW\DIWikiPage;
use SMW\DIProperty;
use SMW\StoreFactory;
use SMWQuery;
use SMW\Query\Language\SomeProperty;
use SMW\Query\Language\ValueDescription;

abstract class ApiDIBase extends ApiBase {

	private $edit;
	protected $currentPage;

	/**
	 * @param ApiMain $main main module
	 * @param string $action name of this module
	 * @param bool $edit whether this API module will be editing the database
	 */
	public function __construct( $main, $action, $edit = false ) {
		parent::__construct( $main, $action );
		$this->edit = $edit;
	}

	/**
	 * execute the API request
	 */
	public function execute() {
		$params = $this->extractRequestParams();
		$this->currentPage = $this->getTitleOrPageId( $params );

		$result = $this->executeBody();
		if ( $result !== null ) {
			$this->getResult()->addValue( null, $this->getModuleName(), $result );
		}
	}

	/**
	 * the real body of the execute function
	 */
	abstract protected function executeBody();

	/**
	 * @return array allowed parameters
	 */
	public function getAllowedParams() {
		return [
			'pageid' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_REQUIRED => false
			],
			'title' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => false
			]
		];
	}

	/**
	 * @return array examples of the use of this API module
	 */
	public function getExamplesMessages() {
		return [
			'action=' . $this->getModuleName() . '&pageid=3' =>
			'apihelp-' . $this->getModuleName() . '-pageid-example',
			'action=' . $this->getModuleName() . '&title=DiscourseIntegration:3' =>
			'apihelp-' . $this->getModuleName() . '-title-example'
		];
	}

	/**
	 * @return string indicates that this API module requires a CSRF token
	 */
	public function needsToken() {
		if ( $this->edit ) {
			return 'csrf';
		} else {
			return false;
		}
	}

	protected function getTopicIdForPageId()
	{
		$wikiTitle = $this->currentPage->getTitle();
		$external_id = $wikiTitle->getArticleID();

		$api = $this->getDiscourseAPI();

		$r = $api->getTopicByExternalID($external_id);

		if (isset($r->apiresult->id))
			return $r->apiresult->id;

		return false;
	}

	/**
	 * Find the Discourse username for the currently logged in user on the wiki.
	 * If the user does not exists, create it
	 */
	protected function getCurrentlyLoggedInDiscourseUserName()
	{
		$user = $this->getUser();

		if ( $user->isAnon() ) {
			$this->dieCustomUsageMessage(
				'discourseintegration-api-error-watch-notloggedin' );
		}

		// Find the email of the logged in user
		if ( $user->isAnon() ) {
			// Should not be possible, this is a special
		}

		$userEmail = $user->getEmail();
		$userEmail = str_replace('tripleperformance.fr', 'neayi.com', $userEmail);

		// Find the user on discourse
		$api = $this->getDiscourseAPI();
        $username = $api->getUsernameByEmail($userEmail);
        if (!empty($username))
	        return $username;

		// Not found ? Create it now (it will be synched properly by insights later)
		try {
			return $api->createDiscourseUser($user);
		} catch (\Throwable $th) {
			if (!empty($username))
			{
				$this->dieCustomUsageMessage(
					'discourseintegration-api-error-watch-no-discourse-user' );
			}
		}
	}

	/**
	 * die with a custom usage message
	 * @param string $message_name the name of the custom message
	 */
	protected function dieCustomUsageMessage( $message_name ) {
		$error_message = wfMessage( $message_name );
		$this->dieWithError( $error_message );
	}

	protected function getDiscourseAPI()
	{
		if ( empty($GLOBALS['wgDiscourseAPIKey']) || empty($GLOBALS['wgDiscourseHost']) ) {
			wfDebugLog('DiscourseIntegration', 'Missing Discourse configuration: APIKey=' . 
				(empty($GLOBALS['wgDiscourseAPIKey']) ? 'MISSING' : 'SET') . 
				', Host=' . (empty($GLOBALS['wgDiscourseHost']) ? 'MISSING' : 'SET'));
			$this->dieCustomUsageMessage('discourseintegration-api-error-missing-config');
		}

		wfDebugLog('DiscourseIntegration', 'Initializing DiscourseAPI with host: ' . $GLOBALS['wgDiscourseHost']);

		if ($GLOBALS['env'] == 'dev')
		{
			return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
									'http', '', '', true);
		}
		else
		{
			return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
									'https', '', '', false);
		}
	}

	/** 
	 * Checks if the current page is a tag
	 * @return bool true if the current page is a tag
	 */
	protected function isTag() {
		$title = $this->currentPage->getTitle();
		
		$smwStore = StoreFactory::getStore();

		$property = DIProperty::newFromUserLabel('A un mot-clé');
		$value = DIWikiPage::newFromTitle( $title );
		$description = new SomeProperty(
			$property,
			new ValueDescription($value)
		);

		$query = new \SMWQuery($description);
		$query->setLimit(1);

		// Use SMW Query API to execute the query
		$queryResult = $smwStore->getQueryResult( $query );
		
		return $queryResult->getCount() > 0;
	}


	/**
	 * Create a tag.
	 * If the tag exists, do nothing
	 * If the tag doesn't exist yet, create the tag, then enroll following users to the new tag
	 */
	protected function createTagForPage($tag, $articleId) {
		$api = $this->getDiscourseAPI();
		
		if ($api->tagExists($tag))
			return;

		$api->createTag($tag, $GLOBALS['wgDiscourseDefaultTagGroupId']);

		$usernames = $this->getFollowingUsersForArticle($articleId);

		foreach ($usernames as $username)
			$api->watchTag($tag, $username);

		return true;
	}

	/**
	 * Ask insights to know the usernames that follow a given article
	 * Returns an array of strings (usernames)
	 */
	protected function getFollowingUsersForArticle($articleId) {
        // Ask insights about who decided to follow the page and subscribe them too:
        $insightsURL = $GLOBALS['wgInsightsRootAPIURL']; // http://insights/';
		
		// Get the current wiki language code
		$wikiLanguage = $GLOBALS['wiki_language']; // Defined in LocalSettings.php
		if (empty($wikiLanguage))
			$wikiLanguage = 'fr'; // Default to French

		$url = $insightsURL . "api/page/$articleId/followers?type=follow&wiki=" . $wikiLanguage;

		$ch = curl_init();

		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		$body = curl_exec($ch);

		$curl_errno = curl_errno($ch);
		$curl_error = curl_error($ch);

		if ($curl_errno > 0) {
			$this->dieCustomUsageMessage('discourseintegration-api-error-curl');
		}

		$rc = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		$resObj = new \stdClass();
		$resObj->http_code = $rc;
		$resObj->apiresult = json_decode($body);

		if (empty($resObj->apiresult) || !isset($resObj->apiresult->data))
		{
			$this->dieCustomUsageMessage('discourseintegration-api-error-insights-request');
		}

		$usernames = [];
		foreach ($resObj->apiresult->data as $aFollower)
		{
			if (empty($aFollower->user->discourse_username))
			{
				wfDebugLog( 'DiscourseIntegration', "Empty follower : " . print_r($aFollower, true) . "\n");
				continue;
			}

			$usernames[] = $aFollower->user->discourse_username;
		}		

		return $usernames;
	}

}
